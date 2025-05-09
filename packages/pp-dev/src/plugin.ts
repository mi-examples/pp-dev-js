import { IndexHtmlTransformResult, Plugin, ServerOptions } from 'vite';
import proxyPassMiddleware from './lib/proxy-pass.middleware.js';
import { MiAPI } from './lib/pp.middleware.js';
import { redirect, urlReplacer } from './lib/helpers/url.helper.js';
import { ClientService } from './lib/client.service.js';
import { initProxyCache } from './lib/proxy-cache.middleware.js';
import { DistService } from './lib/dist.service.js';
import { initRewriteResponse } from './lib/rewrite-response.middleware.js';
import { initPPRedirect } from './lib/pp-redirect.middleware.js';
import { initLoadPPData } from './lib/load-pp-data.middleware.js';
import type { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import internalServer from './lib/internal.middleware';

type RequiredSelection<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

interface DistZipOptions {
  /**
   * Output ZIP archive file name.
   * You can use `[templateName]` placeholder to replace it with the template name.
   * @default `${templateName}.zip`
   */
  outFileName?: string;

  /**
   * Output directory for the build.
   * @default 'dist-zip'
   */
  outDir?: string;
}

export interface VitePPDevOptions {
  /**
   * Backend base URL to MI instance for the local proxy.
   */
  backendBaseURL?: string;

  /**
   * Portal page ID on the MI instance.
   * @deprecated Use appId instead
   */
  portalPageId?: number;

  /**
   * Application ID on the MI instance.
   * This is a synonym for portalPageId.
   */
  appId?: number;

  /**
   * Template name or PP internal name that will be used for the asset generation.
   * Equals to package.json name field value.
   */
  templateName: string;

  /**
   * Enable or disable template variables loading from the backend.
   */
  templateLess?: boolean;

  /**
   * Enable or disable MI top bar and scripts loading from the backend for local development.
   */
  miHudLess?: boolean;

  /**
   * Enable or disable request caching to the backend by the local proxy.
   * @default true
   */
  enableProxyCache?: boolean;

  /**
   * Request caching time in milliseconds.
   * @default 600000 (10 minutes)
   */
  proxyCacheTTL?: number;

  /**
   * Disable SSL certificate validation for MI instances with self-signed certificates.
   * @default false
   */
  disableSSLValidation?: boolean;

  /**
   * Image optimizer options.
   * @default true
   */
  imageOptimizer?: boolean | Parameters<typeof ViteImageOptimizer>[0];

  /**
   * Output directory for the build.
   * @default 'dist'
   */
  outDir?: string;

  /**
   * Disable or enable packing the build output into a ZIP archive.
   * @default true
   */
  distZip?: boolean | DistZipOptions;

  /**
   * Backups an asset directory path for sync with the MI instance.
   * @default backups
   */
  syncBackupsDir?: string;

  /**
   * Enable Metric Insights v7 features.
   * @default false
   * @since 0.8.0
   */
  v7Features?: boolean;

  /**
   * Personal Access Token for the MI instance.
   * @default process.env.MI_ACCESS_TOKEN
   * @since 0.10.0
   * @example
   * ```ts
   * import vitePPDev from '@metricinsights/pp-dev';
   *
   * export default vitePPDev({
   *   personalAccessToken: process.env.MI_ACCESS_TOKEN,
   *   // other options...
   * });
   * ```
   */
  personalAccessToken?: string;
}

export type NormalizedVitePPDevOptions = RequiredSelection<
  VitePPDevOptions,
  | 'templateName'
  | 'templateLess'
  | 'miHudLess'
  | 'enableProxyCache'
  | 'proxyCacheTTL'
  | 'disableSSLValidation'
  | 'imageOptimizer'
  | 'outDir'
  | 'distZip'
  | 'syncBackupsDir'
  | 'v7Features'
  | 'personalAccessToken'
>;

// Add more specific types for validation
type ValidationResult = { isValid: true } | { isValid: false; error: string };

function validateConfigValue<T>(value: T, validator: (v: T) => boolean, errorMessage: string): ValidationResult {
  return validator(value) ? { isValid: true } : { isValid: false, error: errorMessage };
}

function validateConfig(config: VitePPDevOptions): ValidationResult {
  const validations: ValidationResult[] = [
    validateConfigValue(
      config,
      (c): c is VitePPDevOptions => typeof c === 'object' && c !== null,
      'VitePPDevOptions must be an object',
    ),
    validateConfigValue(
      config.templateName,
      (name): name is string => typeof name === 'string' && name.length > 0,
      'VitePPDevOptions.templateName must be a non-empty string',
    ),
    validateConfigValue(
      config.backendBaseURL,
      (url): url is string | undefined => url === undefined || (typeof url === 'string' && url.length > 0),
      'VitePPDevOptions.backendBaseURL must be a non-empty string if provided',
    ),
    validateConfigValue(
      config.portalPageId,
      (id): id is number | undefined => id === undefined || (typeof id === 'number' && id > 0),
      'VitePPDevOptions.portalPageId must be a positive number if provided',
    ),
    validateConfigValue(
      config.appId,
      (id): id is number | undefined => id === undefined || (typeof id === 'number' && id > 0),
      'VitePPDevOptions.appId must be a positive number if provided',
    ),
    validateConfigValue(
      config.proxyCacheTTL,
      (ttl): ttl is number | undefined => ttl === undefined || (typeof ttl === 'number' && ttl > 0),
      'VitePPDevOptions.proxyCacheTTL must be a positive number if provided',
    ),
  ];

  const invalidResult = validations.find((result) => !result.isValid);

  return invalidResult || { isValid: true };
}

export function normalizeVitePPDevConfig(config: VitePPDevOptions): NormalizedVitePPDevOptions {
  const validationResult = validateConfig(config);

  if (!validationResult.isValid) {
    throw new Error(validationResult.error);
  }

  // Prefer appId over portalPageId if both are provided
  const portalPageId = config.appId ?? config.portalPageId;

  const {
    enableProxyCache = true,
    proxyCacheTTL = 10 * 60 * 1000,
    disableSSLValidation = false,
    imageOptimizer = true,
    miHudLess = false,
    templateLess = false,
    outDir = 'dist',
    distZip = true,
    syncBackupsDir = 'backups',
    v7Features = false,
    personalAccessToken = process.env.MI_ACCESS_TOKEN,
  } = config || {};

  let distZipConfig = distZip;

  if (distZipConfig === true) {
    distZipConfig = {
      outFileName: `${config.templateName}.zip`,
      outDir: 'dist-zip',
    };
  } else if (typeof distZip === 'object') {
    distZipConfig = {
      outFileName:
        typeof distZip.outFileName === 'string'
          ? distZip.outFileName.replace('[templateName]', config.templateName)
          : `${config.templateName}.zip`,
      outDir: distZip.outDir ?? 'dist-zip',
    };
  } else {
    distZipConfig = false;
  }

  let imageOptimizerConfig = imageOptimizer;

  if (typeof imageOptimizer === 'boolean') {
    if (imageOptimizerConfig === true) {
      imageOptimizerConfig = {};
    }
  } else if (typeof imageOptimizer !== 'object') {
    imageOptimizerConfig = false;
  }

  return {
    enableProxyCache,
    proxyCacheTTL,
    disableSSLValidation,
    imageOptimizer: imageOptimizerConfig,
    templateLess,
    miHudLess,
    outDir,
    distZip: distZipConfig,
    syncBackupsDir,
    v7Features,
    personalAccessToken,
    portalPageId,
    ...config,
  } as NormalizedVitePPDevOptions;
}

function validateServerConfig(config: ServerOptions & { base: string }): ValidationResult {
  const validations: ValidationResult[] = [
    validateConfigValue(
      config.base,
      (base): base is string => typeof base === 'string' && base.length > 0 && base !== '/',
      'Server base path cannot be empty or "/"',
    ),
    validateConfigValue(
      config.port,
      (port): port is number | undefined =>
        port === undefined || (typeof port === 'number' && port > 0 && port < 65536),
      'Server port must be a valid port number (1-65535)',
    ),
  ];

  const invalidResult = validations.find((result) => !result.isValid);

  return invalidResult || { isValid: true };
}

interface MiAPIConfig {
  headers: {
    host: string;
    referer: string;
    origin: string;
  };
  portalPageId?: number;
  appId?: number;
  templateLess: boolean;
  disableSSLValidation: boolean;
  v7Features: boolean;
  personalAccessToken?: string;
}

function validateMiAPIConfig(config: MiAPIConfig): ValidationResult {
  const validations: ValidationResult[] = [
    validateConfigValue(
      config.headers,
      (headers): headers is MiAPIConfig['headers'] =>
        typeof headers === 'object' &&
        typeof headers.host === 'string' &&
        typeof headers.referer === 'string' &&
        typeof headers.origin === 'string',
      'MiAPI headers must be properly configured',
    ),
    validateConfigValue(
      config.portalPageId,
      (id): id is number | undefined => id === undefined || (typeof id === 'number' && id > 0),
      'MiAPI portalPageId must be a positive number if provided',
    ),
    validateConfigValue(
      config.appId,
      (id): id is number | undefined => id === undefined || (typeof id === 'number' && id > 0),
      'MiAPI appId must be a positive number if provided',
    ),
    validateConfigValue(
      config.personalAccessToken,
      (token): token is string | undefined => token === undefined || typeof token === 'string',
      'MiAPI personalAccessToken must be a string if provided',
    ),
  ];

  const invalidResult = validations.find((result) => !result.isValid);

  return invalidResult || { isValid: true };
}

interface ProxyCacheConfig {
  devServer: any;
  ttl: number;
}

function validateProxyCacheConfig(config: ProxyCacheConfig): ValidationResult {
  const validations: ValidationResult[] = [
    validateConfigValue(
      config.ttl,
      (ttl): ttl is number => typeof ttl === 'number' && ttl > 0,
      'Proxy cache TTL must be a positive number',
    ),
  ];

  const invalidResult = validations.find((result) => !result.isValid);

  return invalidResult || { isValid: true };
}

function vitePPDev(options: NormalizedVitePPDevOptions): Plugin {
  const {
    templateName,
    templateLess,
    backendBaseURL,
    miHudLess,
    portalPageId,
    enableProxyCache,
    proxyCacheTTL,
    disableSSLValidation,
    distZip,
    syncBackupsDir,
    v7Features,
    personalAccessToken,
  } = options || {};

  // Avoid server caching for index.html file when first loading
  let isFirstRequest = true;
  let baseDir = process.cwd();

  return {
    name: 'vite-pp-dev',
    apply: 'serve',
    config: (config) => {
      const serverConfig: ServerOptions & { base: string } = {
        base: config.base || '',
        ...config.server,
      };

      const validationResult = validateServerConfig(serverConfig);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error);
      }

      config.clientInjectionPlugin = { backendBaseURL, portalPageId: portalPageId, templateLess, v7Features };

      if (v7Features) {
        config.base = `/pl/${templateName}`;
      }

      if (config.root) {
        baseDir = config.root;
      }

      return config;
    },
    transformIndexHtml: async (html, ctx) => {
      const result: IndexHtmlTransformResult = { html, tags: [] };

      if (isFirstRequest) {
        isFirstRequest = false;

        result.tags.push({
          tag: 'script',
          injectTo: 'body',
          children: `${Math.random()}`,
        });
      }

      return result;
    },
    configureServer: (server) => {
      let base = server.config.base;

      if (!base.endsWith('/')) {
        base += '/';
      }

      const baseWithoutTrailingSlash = base.substring(0, base.lastIndexOf('/'));

      server.middlewares.use(initPPRedirect(base, templateName));

      if (backendBaseURL) {
        const baseUrlHost = new URL(backendBaseURL).host;

        const miConfig: MiAPIConfig = {
          headers: {
            host: baseUrlHost,
            referer: backendBaseURL,
            origin: backendBaseURL.replace(/^(https?:\/\/)([^/]+)(\/.*)?$/i, '$1$2'),
          },
          portalPageId,
          appId: portalPageId,
          templateLess,
          disableSSLValidation,
          v7Features,
          personalAccessToken: personalAccessToken ?? process.env.MI_ACCESS_TOKEN,
        };

        const validationResult = validateMiAPIConfig(miConfig);

        if (!validationResult.isValid) {
          throw new Error(validationResult.error);
        }

        const mi = new MiAPI(backendBaseURL, miConfig);

        if (enableProxyCache) {
          let ttl = +proxyCacheTTL;

          if (!ttl || Number.isNaN(ttl) || ttl < 0) {
            ttl = 10 * 60 * 1000; // 10 minutes
          }

          const cacheConfig: ProxyCacheConfig = {
            devServer: server,
            ttl,
          };

          const validationResult = validateProxyCacheConfig(cacheConfig);

          if (!validationResult.isValid) {
            throw new Error(validationResult.error);
          }

          server.middlewares.use(initProxyCache(cacheConfig));
        }

        server.middlewares.use(
          proxyPassMiddleware({
            devServer: server,
            baseURL: backendBaseURL,
            proxyIgnore: ['/@vite', '/@metricinsights', '/@', baseWithoutTrailingSlash],
            disableSSLValidation,
            miAPI: mi,
          }) as any,
        );

        const isIndexRegExp = new RegExp(`^((${base})|/)$`);

        // Get portal page variables from the backend (also, redirect magic)
        server.middlewares.use(initLoadPPData(isIndexRegExp, mi, options));

        internalServer.post('/@api/login', async (req, res, next) => {
          const { token, tokenType } = req.body;

          if (!token) {
            res
              .status(400)
              .json({
                error: 'Token is required',
              })
              .end();

            return;
          }

          const handleError = (reason: any) => {
            server.config.logger.error(reason);

            next(reason);

            return null;
          };

          if (tokenType === 'personal') {
            const testRequest = await mi
              .get<{ user: { user_id: number; username: string } }>(
                '/data/page/index/auth/info',
                {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                true,
              )
              .then(async (response) => {
                if (typeof response.data?.user?.user_id === 'number') {
                  mi.personalAccessToken = token;

                  return response;
                }

                res.status(400).json({ error: 'Token expired or invalid' }).end();
              })
              .catch(handleError);

            if (!testRequest) {
              return;
            }

            redirect(res, '/', 302);
          } else if (tokenType === 'regular') {
            const testRequest = await mi
              .get<{ users: { user_id: number; username: string }[] }>(
                '/api/user',
                {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Token: token,
                },
                true,
              )
              .then((response) => {
                if (response.data?.users?.length) {
                  mi.personalAccessToken = undefined;

                  res.setHeader('set-cookie', response.headers['set-cookie'] ?? '');

                  return response;
                }

                res.status(400).json({ error: 'Token expired or invalid' }).end();
              })
              .catch(handleError);

            if (!testRequest) {
              return;
            }

            redirect(res, '/', 302);
          }
        });

        server.middlewares.use(internalServer);

        const distService =
          distZip !== false
            ? new DistService(
                templateName,
                Object.assign(
                  { backupDir: syncBackupsDir },
                  typeof distZip === 'object'
                    ? { distZipFolder: distZip.outDir, distZipFilename: distZip.outFileName }
                    : undefined,
                ),
              )
            : undefined;

        const eventHandler = new ClientService(server, { distService, miAPI: mi });

        return () => {
          server.middlewares.use(
            initRewriteResponse(
              (url) => {
                console.log('initRewriteResponse.url', url);

                return url.split('?')[0].endsWith('index.html');
              },
              (response, req) => {
                return Buffer.from(urlReplacer(baseUrlHost, req.headers.host ?? '', mi.buildPage(response, miHudLess)));
              },
            ),
          );
        };
      }
    },
  };
}

export default vitePPDev;
