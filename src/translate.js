const { translate: gti } = require("@vitalets/google-translate-api");
const { HttpProxyAgent } = require('http-proxy-agent');
const humanizeString = require("humanize-string");
const camelcase = require("camelcase");
const { getProxyConfig } = require("./utils");

async function translate(text, options) {
    const translateOptions = {
      to: options.to,
      fetchOptions: {}
    };
  
    if (options && options.proxy) {
      const proxyUrl = `http://${options.proxy.auth ? `${options.proxy.auth.username}:${options.proxy.auth.password}@` : ''}${options.proxy.host}:${options.proxy.port}`;
      translateOptions.fetchOptions.agent = new HttpProxyAgent(proxyUrl);
    }
  
    const { text: translatedText } = await gti(text, translateOptions);
    // The old code expected an object with a 'data' array. We'll mimic that.
    return { data: [translatedText] };
  }

  async function getTranslationPromise(selectedText, selectedLanguage, selection) {
    const { host, port, username, password } = getProxyConfig();
    const translationConfiguration = {
      to: selectedLanguage,
    };
    if (!!host) {
      translationConfiguration.proxy = {
        host,
        port: Number(port),
      };
      if (!!username) {
        translationConfiguration.proxy.auth = {
          username,
          password,
        };
      }
    }
  
    try {
      let res = await translate(selectedText, translationConfiguration);
  
      if (!!res && !!res.data) {
        // If google rejects the string it will return the same string as input
        // We can try to split the string into parts, then translate again. Then return it to a
        // camel style casing
        if (res.data[0] === selectedText) {
          const humanizedRes = await translate(humanizeString(selectedText), translationConfiguration);
          if (!!humanizedRes && !!humanizedRes.data) {
            return {
              selection,
              translation: camelcase(humanizedRes.data[0]),
            };
          } else {
            throw new Error("Google Translation API issue on fallback");
          }
        } else {
          return {
            selection,
            translation: res.data[0],
          };
        }
      } else {
        throw new Error("Google Translation API issue");
      }
    } catch (e) {
      // The original function returned a Promise.reject, so we'll throw an error
      // which will be caught by the caller's .catch block.
      throw new Error("Google Translation API issue: " + e.message);
    }
  }

  module.exports = {
      getTranslationPromise
  }
