const gtoa = require("google-translate-api");
const tunnel = require("tunnel");

/**
 * Implement the google-translate-open-api interface
 * @see {@link https://github.com/hua1995116/google-translate-open-api#translatetext-options}
 * @param {string} text
 * @param {object} options google-translate-open-api translate options
 */
function translate(text, options) {
  const gotopts = {};
  if (options && options.proxy) {
    const proxy = {
      host: options.proxy.host,
      port: options.proxy.port,
      headers: {
        "User-Agent": "Node",
      },
    };
    if (options.proxy.auth) {
      proxy.proxyAuth = `${options.proxy.auth.username}:${options.proxy.auth.password}`;
    }

    gotopts.agent = tunnel.httpsOverHttp({
      proxy: proxy,
    });
  }
  return gtoa(text, options, gotopts).then((res) => {
    res.data = [res.text];
    return res;
  });
}

module.exports.translate = translate;
