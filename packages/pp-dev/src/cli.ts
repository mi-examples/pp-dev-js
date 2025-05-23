import * as path from 'path';
import * as fs from 'fs';
import { performance } from 'node:perf_hooks';
import { cac } from 'cac';
import { ServerOptions, BuildOptions, LogLevel, InlineConfig, loadEnv } from 'vite';
import { VERSION } from './constants.js';
import { bindShortcuts } from './shortcuts.js';
import { getViteConfig, PPDevConfig } from './index.js';
import { mergeConfig, build, optimizeDeps, resolveConfig, preview, ViteDevServer, loadConfigFromFile } from 'vite';
import { parse } from 'url';
import { initRewriteResponse } from './lib/rewrite-response.middleware.js';
import type DevServer from 'next/dist/server/dev/next-dev-server';
import type { NextConfig } from 'next';
import { initPPRedirect } from './lib/pp-redirect.middleware.js';
import { MiAPI } from './lib/pp.middleware.js';
import { initProxyCache } from './lib/proxy-cache.middleware.js';
import proxyPassMiddleware from './lib/proxy-pass.middleware.js';
import { initLoadPPData } from './lib/load-pp-data.middleware.js';
import { cutUrlParams, urlReplacer, redirect } from './lib/helpers/url.helper.js';
import { createDevServer } from './lib/helpers/server.js';
import { createLogger } from './lib/logger.js';
import { colors } from './lib/helpers/color.helper.js';
import { ChangelogGenerator } from './lib/changelog-generator.js';
import { IconFontGenerator } from './lib/icon-font-generator.js';
import * as process from 'node:process';
import internalServer from './lib/internal.middleware';
import type { Request, Response, NextFunction } from 'express';

const cli = cac('pp-dev');

interface PPDevBuildOptions extends BuildOptions {
  changelog?: boolean | string;
}

// global options
interface GlobalCLIOptions {
  '--'?: string[];
  c?: boolean | string;
  config?: string;
  base?: string;
  l?: LogLevel;
  logLevel?: LogLevel;
  clearScreen?: boolean;
  d?: boolean | string;
  debug?: boolean | string;
  f?: string;
  filter?: string;
  m?: string;
  mode?: string;
  force?: boolean;
}

interface ChangelogOptions {
  oldAssetsPath?: string;
  newAssetsPath?: string;
  destination?: string;
  filename?: string;
}

interface IconFontOptions {
  source?: string;
  destination?: string;
  fontName?: string;
}

let profileSession = (global as any).__pp_dev_profile_session;
let profileCount = 0;

export const stopProfiler = (log: (message: string) => void): void | Promise<void> => {
  if (!profileSession) {
    return;
  }

  return new Promise((res, rej) => {
    profileSession!.post('Profiler.stop', (err: any, { profile }: any) => {
      // Write profile to disk, upload, etc.
      if (!err) {
        const outPath = path.resolve(`./pp-dev-profile-${profileCount++}.cpuprofile`);
        fs.writeFileSync(outPath, JSON.stringify(profile));
        log(colors.yellow(`CPU profile written to ${colors.white(colors.dim(outPath))}`));
        profileSession = undefined;
        res();
      } else {
        rej(err);
      }
    });
  });
};

const filterDuplicateOptions = <T extends object>(options: T) => {
  for (const [key, value] of Object.entries(options)) {
    if (Array.isArray(value)) {
      options[key as keyof T] = value[value.length - 1];
    }
  }
};
/**
 * removing global flags before passing as command specific sub-configs
 */
function cleanOptions<Options extends GlobalCLIOptions>(options: Options): Omit<Options, keyof GlobalCLIOptions> {
  const ret = { ...options };
  delete ret['--'];
  delete ret.c;
  delete ret.config;
  delete ret.base;
  delete ret.l;
  delete ret.logLevel;
  delete ret.clearScreen;
  delete ret.d;
  delete ret.debug;
  delete ret.f;
  delete ret.filter;
  delete ret.m;
  delete ret.mode;

  return ret;
}

cli
  .option('-c, --config <file>', `[string] use specified config file`)
  .option('--base <path>', `[string] public base path (default: /)`)
  .option('-l, --logLevel <level>', `[string] info | warn | error | silent`)
  .option('--clearScreen', `[boolean] allow/disable clear screen when logging`)
  .option('-d, --debug [feat]', `[string | boolean] show debug logs`)
  .option('-f, --filter <filter>', `[string] filter debug logs`)
  .option('-m, --mode <mode>', `[string] set env mode`);

// dev
cli
  .command('[root]', 'start dev server') // default command
  .alias('serve') // the command is called 'serve' in Vite's API
  .alias('dev') // alias to align with the script name
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--https', `[boolean] use TLS + HTTP/2`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .option('--cors', `[boolean] enable CORS`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option('--force', `[boolean] force the optimizer to ignore the cache and re-bundle`)
  .action(async (root: string, options: ServerOptions & GlobalCLIOptions) => {
    filterDuplicateOptions(options);
    // output structure is preserved even after bundling so require()
    // is ok here
    const { createServer } = await import('vite');

    try {
      const configFromFile = await loadConfigFromFile(
        { mode: options.mode || 'development', command: 'serve' },
        options.config,
        root,
        options.logLevel,
      );

      let config = await getViteConfig();

      const envVars = loadEnv(options.mode || 'development', root ?? process.cwd(), '');

      if (envVars) {
        Object.keys(envVars).forEach((key) => {
          if (key.startsWith('MI_')) {
            process.env[key] = envVars[key];
          }
        });
      }

      if (configFromFile) {
        const { plugins, ...fileConfig } = configFromFile.config;

        config = mergeConfig(config, fileConfig);
      }

      const server = await createServer(
        mergeConfig(
          config,
          {
            root,
            base: options.base,
            mode: options.mode,
            configFile: options.config,
            logLevel: options.logLevel,
            clearScreen: options.clearScreen,
            optimizeDeps: { force: options.force },
            server: cleanOptions(options),
            customLogger: createLogger(options.logLevel),
          },
          true,
        ),
      );

      if (!server.config.base || server.config.base === '/') {
        throw new Error('base cannot be equal to "/" or empty string');
      }

      if (!server.httpServer) {
        throw new Error('HTTP server not available');
      }

      await server.listen();

      const logger = createLogger(options.logLevel);

      const ppDevStartTime = (global as any).__pp_dev_start_time ?? false;
      const startupDurationString = ppDevStartTime
        ? colors.dim(`ready in ${colors.reset(colors.bold(Math.ceil(performance.now() - ppDevStartTime)))} ms`)
        : '';

      logger.info(`\n  ${colors.green(`${colors.bold('PP-DEV')} v${VERSION}`)}  ${startupDurationString}\n`);

      server.printUrls();
      bindShortcuts(server, {
        print: true,
        customShortcuts: [
          profileSession && {
            key: 'p',
            description: 'start/stop the profiler',
            async action(server) {
              if (profileSession) {
                await stopProfiler(logger.info);
              } else {
                const inspector = await import('node:inspector').then((r) => (r as any).default);
                await new Promise<void>((res) => {
                  profileSession = new inspector.Session();
                  profileSession.connect();
                  profileSession.post('Profiler.enable', () => {
                    profileSession?.post('Profiler.start', () => {
                      logger.info('Profiler started');

                      res();
                    });
                  });
                });
              }
            },
          },
          {
            key: 'l',
            description: 'proxy re-login',
            action(server: ViteDevServer): void | Promise<void> {
              server.ws.send({
                type: 'custom',
                event: 'redirect',
                data: { url: `/auth/index/logout?proxyRedirect=${encodeURIComponent('/')}` },
              });
            },
          },
        ],
      });
    } catch (e: any) {
      const logger = createLogger(options.logLevel);

      logger.error(colors.red(`error when starting dev server:\n${e.stack}`), {
        error: e,
      });
      stopProfiler(logger.info);

      process.exit(1);
    }
  });

// dev
cli
  .command('next [root]', 'start dev server') // default command
  .alias('next-serve') // the command is called 'serve' in Vite's API
  .alias('next-dev') // alias to align with the script name
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`, { default: 3000 })
  .option('--https', `[boolean] use TLS + HTTP/2`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .option('--cors', `[boolean] enable CORS`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option('--force', `[boolean] force the optimizer to ignore the cache and re-bundle`)
  .action(async (root: string, options: ServerOptions & GlobalCLIOptions) => {
    filterDuplicateOptions(options);

    const { default: next } = await import('next');

    const logger = createLogger();

    const server = createDevServer(options.logLevel);
    const opts = cleanOptions(options);

    const envVars = loadEnv(options.mode || 'development', root ?? process.cwd(), '');

    if (envVars) {
      Object.keys(envVars).forEach((key) => {
        if (key.startsWith('MI_')) {
          process.env[key] = envVars[key];
        }
      });
    }

    const app = next({ dev: true, hostname: opts.host as string, port: opts.port });

    await app.prepare();

    const nextServer = (await (app as any).getServer()) as DevServer & { nextConfig: NextConfig };

    let base = nextServer.nextConfig.basePath;
    const { assetPrefix } = nextServer.nextConfig;

    if (!base.endsWith('/')) {
      base += '/';
    }

    if (base === '/') {
      throw new Error('basePath cannot be equal to "/" or empty string');
    }

    const baseWithoutTrailingSlash = base.substring(0, base.lastIndexOf('/'));
    const templateName = nextServer.nextConfig.serverRuntimeConfig.templateName as string;

    const ppDevConfig = nextServer.nextConfig.serverRuntimeConfig.ppDevConfig as PPDevConfig;

    const {
      backendBaseURL,
      portalPageId: ppId,
      appId,
      templateLess = true,
      enableProxyCache = true,
      miHudLess = true,
      proxyCacheTTL = 10 * 60 * 1000,
      disableSSLValidation = false,
      v7Features = false,
      personalAccessToken = process.env.MI_ACCESS_TOKEN,
    } = ppDevConfig;

    const portalPageId = appId ?? ppId;

    server.use(initPPRedirect(base, templateName));

    if (backendBaseURL) {
      let baseUrlHost: string;

      try {
        baseUrlHost = new URL(backendBaseURL).host;
      } catch (err) {
        logger.error(colors.red(`Invalid backendBaseURL: ${backendBaseURL}`));

        process.exit(1);
      }

      const mi = new MiAPI(backendBaseURL, {
        headers: {
          host: baseUrlHost,
          referer: backendBaseURL,
          origin: backendBaseURL.replace(/^(https?:\/\/)([^/]+)(\/.*)?$/i, '$1$2'),
        },
        portalPageId,
        templateLess,
        disableSSLValidation,
        v7Features,
        personalAccessToken,
      });

      if (enableProxyCache) {
        let ttl = +proxyCacheTTL;

        if (!ttl || Number.isNaN(ttl) || ttl < 0) {
          ttl = 10 * 60 * 1000; // 10 minutes
        }

        server.use(initProxyCache({ devServer: server, ttl }));
      }

      const proxyIgnore = ['/@vite', '/@metricinsights', '/@', baseWithoutTrailingSlash];

      if (assetPrefix) {
        proxyIgnore.push(assetPrefix);
      }

      server.use(
        proxyPassMiddleware({
          devServer: server,
          baseURL: backendBaseURL,
          proxyIgnore,
          disableSSLValidation,
          miAPI: mi,
        }) as any,
      );

      const isIndexRegExp = new RegExp(`^((${base})|/)$`);

      // Get portal page variables from the backend (also, redirect magic)
      server.use(initLoadPPData(isIndexRegExp, mi, ppDevConfig));

      server.use(
        initRewriteResponse(
          (url) => {
            return isIndexRegExp.test(cutUrlParams(url));
          },
          (response, req) => {
            return Buffer.from(urlReplacer(baseUrlHost, req.headers.host ?? '', mi.buildPage(response, miHudLess)));
          },
        ),
      );

      // Add internal server for token handling
      internalServer.post('/@api/login', async (req: Request, res: Response, next: NextFunction) => {
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
          logger.error(reason);
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

      server.use(internalServer);
    }

    const handle = app.getRequestHandler();

    server.all('*', (req, res) => {
      try {
        if (req.url?.startsWith(assetPrefix) && assetPrefix !== baseWithoutTrailingSlash) {
          const newUrl = req.url.replace(assetPrefix, baseWithoutTrailingSlash);
          const parsedUrl = parse(newUrl, true);

          if (!parsedUrl.pathname) {
            res.statusCode = 400;
            res.end('Invalid URL');

            return;
          }

          return handle(req, res, parsedUrl);
        }

        const parsedUrl = parse(req.url || '/', true);

        if (!parsedUrl.pathname) {
          res.statusCode = 400;
          res.end('Invalid URL');

          return;
        }

        handle(req, res, parsedUrl);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        logger.error(colors.red(`Error handling request: ${errorMessage}`));

        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    try {
      await new Promise((resolve) => {
        if (opts.host) {
          resolve(
            server.listen(opts.port as number, opts.host as string, () => {
              //
            }),
          );
        } else {
          resolve(
            server.listen(opts.port, () => {
              //
            }),
          );
        }
      });

      const ppDevStartTime = (global as any).__pp_dev_start_time ?? false;
      const startupDurationString = ppDevStartTime
        ? colors.dim(`ready in ${colors.reset(colors.bold(Math.ceil(performance.now() - ppDevStartTime)))} ms`)
        : '';

      logger.info(`\n  ${colors.green(`${colors.bold('PP-DEV')} v${VERSION}`)}  ${startupDurationString}\n`, {
        clear: true,
      });

      server.printUrls(base);
    } catch (e: any) {
      const logger = createLogger(options.logLevel);

      logger.error(colors.red(`error when starting dev server:\n${e.stack}`), {
        error: e,
      });
      stopProfiler(logger.info);

      process.exit(1);
    }
  });

// build
cli
  .command('build [root]', 'build for production')
  .option('--target <target>', `[string] transpile target (default: 'modules')`)
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .option('--assetsDir <dir>', `[string] directory under outDir to place assets in (default: assets)`)
  .option('--assetsInlineLimit <number>', `[number] static asset base64 inline threshold in bytes (default: 4096)`)
  .option('--ssr [entry]', `[string] build specified entry for server-side rendering`)
  .option('--sourcemap [output]', `[boolean | "inline" | "hidden"] output source maps for build (default: false)`)
  .option(
    '--minify [minifier]',
    `[boolean | "terser" | "esbuild"] enable/disable minification, ` + `or specify minifier to use (default: esbuild)`,
  )
  .option('--manifest [name]', `[boolean | string] emit build manifest json`)
  .option('--ssrManifest [name]', `[boolean | string] emit ssr manifest json`)
  .option('--force', `[boolean] force the optimizer to ignore the cache and re-bundle (experimental)`)
  .option('--emptyOutDir', `[boolean] force empty outDir when it's outside of root`)
  .option('-w, --watch', `[boolean] rebuilds when modules have changed on disk`)
  .option(
    '--changelog [assetsFile]',
    `[boolean | string] generate changelog between assetsFile and current build (default: false)`,
  )
  .action(async (root: string, options: PPDevBuildOptions & GlobalCLIOptions) => {
    filterDuplicateOptions(options);
    const buildOptions: PPDevBuildOptions = cleanOptions(options);

    try {
      const configFromFile = await loadConfigFromFile(
        { mode: options.mode || 'production', command: 'build' },
        options.config,
        root,
        options.logLevel,
      );

      let config = await getViteConfig();

      if (configFromFile) {
        const { plugins, ...fileConfig } = configFromFile.config;

        config = mergeConfig(config, fileConfig);
      }

      const buildConfig = mergeConfig(
        config,
        {
          root,
          base: options.base,
          mode: options.mode,
          configFile: options.config,
          logLevel: options.logLevel,
          clearScreen: options.clearScreen,
          optimizeDeps: { force: options.force },
          build: buildOptions,
        },
        true,
      ) as InlineConfig;

      await build(buildConfig);

      if (buildOptions.changelog) {
        const executionRoot = root || process.cwd();

        const outDir = buildConfig.build?.outDir || 'dist';

        let oldAssetsPath = '';

        if (typeof buildOptions.changelog === 'string') {
          oldAssetsPath = path.resolve(executionRoot, buildOptions.changelog);
        } else {
          const backupsDirPath = path.resolve(executionRoot, buildConfig.ppDevConfig?.syncBackupsDir || 'backups');

          if (!fs.existsSync(backupsDirPath)) {
            createLogger(options.logLevel).warn(
              colors.yellow(`backups directory not found, skipping changelog generation`),
            );

            return;
          }

          const backups = fs.readdirSync(backupsDirPath, { withFileTypes: true });

          if (!backups.length) {
            createLogger(options.logLevel).warn(colors.yellow(`no backups found, skipping changelog generation`));

            return;
          }

          const latestBackup = backups
            .filter((value) => {
              return value.isFile() && value.name.endsWith('.zip');
            })
            .reduce((latest, current) => {
              const latestTime = fs.statSync(path.resolve(backupsDirPath, latest.name)).mtimeMs;
              const currentTime = fs.statSync(path.resolve(backupsDirPath, current.name)).mtimeMs;

              return latestTime > currentTime ? latest : current;
            }, backups[0]).name;

          oldAssetsPath = path.resolve(backupsDirPath, latestBackup);
        }

        const currentAssetFilePath = path.resolve(executionRoot, outDir);

        let changelogDestination = 'dist-zip';

        if (buildConfig.ppDevConfig) {
          if (buildConfig.ppDevConfig.distZip === false) {
            changelogDestination = (buildConfig.build?.outDir as string) || 'dist';
          } else if (
            typeof buildConfig.ppDevConfig.distZip === 'object' &&
            typeof buildConfig.ppDevConfig.distZip.outDir === 'string'
          ) {
            changelogDestination = buildConfig.ppDevConfig.distZip.outDir;
          }
        }

        const changelogGenerator = new ChangelogGenerator({
          oldAssetsPath,
          newAssetsPath: currentAssetFilePath,
          destinationPath: path.resolve(executionRoot, changelogDestination),
        });

        await changelogGenerator.generateChangelog();
      }
    } catch (e: any) {
      createLogger(options.logLevel).error(colors.red(`error during build:\n${e.stack}`), { error: e });

      process.exit(1);
    } finally {
      stopProfiler((message) => createLogger(options.logLevel).info(message));
    }
  });

// changelog
cli
  .command('changelog [oldAssetPath] [newAssetPath]', 'generate changelog between two assets files/folders')
  .option('--oldAssetsPath <oldAssetsPath>', `[string] path to the old assets zip file or folder`)
  .option('--newAssetsPath <newAssetsPath>', `[string] path to the new assets zip file or folder`)
  .option('--destination <destination>', `[string] destination folder for the changelog (default: .)`)
  .option('--filename <filename>', `[string] filename for the changelog (default: CHANGELOG.html)`)
  .action(async (oldAssetPath: string, newAssetPath: string, options: ChangelogOptions & GlobalCLIOptions) => {
    filterDuplicateOptions(options);

    const {
      oldAssetsPath: oldPath = oldAssetPath,
      newAssetsPath: newPath = newAssetPath,
      destination = '.',
      filename = 'CHANGELOG.html',
      logLevel,
    } = options;

    const root = process.cwd();

    if (!oldPath || !newPath) {
      createLogger(logLevel).error(
        colors.red(`error during changelog generation: oldAssetPath and newAssetPath are required`),
      );

      process.exit(1);
    }

    const fullOldPath = path.resolve(root, oldPath);
    const fullNewPath = path.resolve(root, newPath);
    const fullDestination = path.resolve(root, destination);

    const changelogGenerator = new ChangelogGenerator({
      oldAssetsPath: fullOldPath,
      newAssetsPath: fullNewPath,
      destinationPath: fullDestination,
      changelogFilename: filename,
    });

    await changelogGenerator.generateChangelog();
  });

cli
  .command('generate-icon-font [source] [destination]', 'generate icon font from SVG files')
  .option('--source <source>', `[string] path to the source directory with SVG files`)
  .option('--destination <destination>', `[string] path to the destination directory to save the generated font files`)
  .option('--font-name, -n <fontName>', `[string] name of the font to generate (default: 'icon-font')`)
  .action(async (source: string, destination: string, options: IconFontOptions & GlobalCLIOptions) => {
    filterDuplicateOptions(options);

    const { source: sourceDir = source, destination: destDir = destination, fontName = 'icon-font' } = options;

    const root = process.cwd();

    const fullSourceDir = path.resolve(root, sourceDir);
    const fullDestDir = path.resolve(root, destDir);

    const iconFontGenerator = new IconFontGenerator({
      sourceDir: fullSourceDir,
      outputDir: fullDestDir,
      fontName,
    });

    const logger = createLogger(options.logLevel);

    logger.info(`Generating icon font from SVG files in ${colors.dim(fullSourceDir)}`);

    await iconFontGenerator.generate();

    logger.info(`Icon font generated and saved to ${colors.dim(fullDestDir)}`);
  });

// optimize
cli
  .command('optimize [root]', 'pre-bundle dependencies')
  .option('--force', `[boolean] force the optimizer to ignore the cache and re-bundle`)
  .action(async (root: string, options: { force?: boolean } & GlobalCLIOptions) => {
    filterDuplicateOptions(options);
    try {
      const configFromFile = await loadConfigFromFile(
        { mode: options.mode || 'production', command: 'build' },
        options.config,
        root,
        options.logLevel,
      );

      let config = await getViteConfig();

      if (configFromFile) {
        const { plugins, ...fileConfig } = configFromFile.config;

        config = mergeConfig(config, fileConfig);
      }

      const optimizeConfig = await resolveConfig(
        mergeConfig(config, {
          root,
          base: options.base,
          configFile: options.config,
          logLevel: options.logLevel,
          mode: options.mode,
        }),
        'serve',
      );

      await optimizeDeps(optimizeConfig, options.force, true);
    } catch (e: any) {
      createLogger(options.logLevel).error(colors.red(`error when optimizing deps:\n${e.stack}`), { error: e });

      process.exit(1);
    }
  });

cli
  .command('preview [root]', 'locally preview production build')
  .option('--host [host]', `[string] specify hostname`)
  .option('--port <port>', `[number] specify port`)
  .option('--strictPort', `[boolean] exit if specified port is already in use`)
  .option('--https', `[boolean] use TLS + HTTP/2`)
  .option('--open [path]', `[boolean | string] open browser on startup`)
  .option('--outDir <dir>', `[string] output directory (default: dist)`)
  .action(
    async (
      root: string,
      options: {
        host?: string | boolean;
        port?: number;
        https?: boolean;
        open?: boolean | string;
        strictPort?: boolean;
        outDir?: string;
      } & GlobalCLIOptions,
    ) => {
      filterDuplicateOptions(options);

      try {
        const configFromFile = await loadConfigFromFile(
          { mode: options.mode || 'production', command: 'build' },
          options.config,
          root,
          options.logLevel,
        );

        let config = await getViteConfig();

        if (configFromFile) {
          const { plugins, ...fileConfig } = configFromFile.config;

          config = mergeConfig(config, fileConfig);
        }

        const server = await preview(
          mergeConfig(config, {
            root,
            base: options.base,
            configFile: options.config,
            logLevel: options.logLevel,
            mode: options.mode,
            build: {
              outDir: options.outDir,
            },
            preview: {
              port: options.port,
              strictPort: options.strictPort,
              host: options.host,
              https: options.https,
              open: options.open,
            },
          }),
        );

        server.printUrls();
      } catch (e: any) {
        createLogger(options.logLevel).error(colors.red(`error when starting preview server:\n${e.stack}`), {
          error: e,
        });

        process.exit(1);
      } finally {
        stopProfiler((message) => createLogger(options.logLevel).info(message));
      }
    },
  );

cli.help();
cli.version(VERSION);

cli.parse();
