import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { urlReplacer, urlPathReplacer } from './helpers/url.helper.js';
import { ViteDevServer } from 'vite';

export interface ProxyOpts {
  rewritePath?: string | string[] | RegExp;

  baseURL: string;

  proxyIgnore?: (string | RegExp)[];

  viteDevServer: ViteDevServer;
}

const hostOriginRegExp = /^(https?:\/\/)([^/]+)(\/.*)?$/i;
export const PROXY_HEADER = 'X-PP-Proxy';

export function initProxy(opts: ProxyOpts) {
  const { rewritePath = /^\/(?!pt).*/i, baseURL = '', viteDevServer } = opts;

  if (!baseURL) {
    throw new Error('Base url is required');
  }

  const host = baseURL.replace(hostOriginRegExp, '$2');
  const origin = baseURL.replace(hostOriginRegExp, '$1$2');

  const fileType = import('file-type');

  return createProxyMiddleware(
    (pathname) => {
      if (
        (opts.proxyIgnore || []).some((value) => {
          if (typeof value === 'string') {
            return pathname.startsWith(value);
          } else if (typeof value.test === 'function') {
            return value.test(pathname);
          }

          return true;
        })
      ) {
        return false;
      }

      if (typeof rewritePath === 'string') {
        return pathname.startsWith(rewritePath);
      } else if (Array.isArray(rewritePath)) {
        return rewritePath.some((rP) => pathname.startsWith(rP));
      } else if (typeof rewritePath.test === 'function') {
        return rewritePath.test(pathname);
      }

      return false;
    },
    {
      /**
       * IMPORTANT: avoid res.end being called automatically
       **/
      selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()

      target: baseURL,
      changeOrigin: true,
      autoRewrite: true,
      logLevel: 'silent',
      headers: {
        host,
        origin,
      },
      onProxyReq(proxyReq, req, res) {
        const host = req.headers.host;
        const referer = proxyReq.getHeader('referer');

        viteDevServer.config.logger.info(
          `Proxies request: ${req.method} ${req.url} -> ${proxyReq.method} ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`,
        );

        if (host && referer && typeof referer === 'string') {
          proxyReq.setHeader('referer', referer.replace(new RegExp(`https?://${host}`), baseURL));
        }

        req.socket.on('close', () => {
          setTimeout(() => {
            if (!proxyReq.destroyed) {
              proxyReq.destroy();
            }
          }, 200);
        });

        return proxyReq;
      },
      onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        res.setHeader(PROXY_HEADER, 1);

        const type = await (await fileType).fileTypeFromBuffer(responseBuffer);

        if (type) {
          return responseBuffer;
        } else {
          let response = responseBuffer.toString('utf8'); // convert buffer to string

          try {
            const reqUrl = new URL(req.url ?? '', `http://${host}`);

            if (reqUrl.searchParams && reqUrl.searchParams.has('proxyRedirect')) {
              response +=
                '<script>' +
                'const params = new URLSearchParams(window.location.search);' +
                "if (params.has('proxyRedirect')) {" +
                " setTimeout(() => { window.location = params.get('proxyRedirect'); }, 50);" +
                '}' +
                '</script>';
            }
          } catch {
            //
          }

          const reqHost = req.headers.host ?? '';

          // manipulate response and return the result
          return urlPathReplacer('/auth/saml/login', '/login', urlReplacer(host, reqHost, response));
        }
      }),
    },
  );
}

export default initProxy;
