const ga = require("./google-api");
const gtoa = require("./google-translate-open-api");
const gta = require("./google-translate-api");

/**
 * Enum for translators modules
 * @readonly
 * @enum {number}
 */
const VSGT_MODULE = {
  GA: 1,
  GTA: 2,
  GTOA: 3,
};

/**
 * @typedef {Object} VSGTParams
 * @property {VSGT_MODULE} module
 * @property {object} options
 */

/**
 * The following function is very important.
 * It represents the beginning of the API for this application.
 *
 * @param {string} text for translation
 * @param {VSGTParams|object} params
 */
function translate(text, params) {
  const module = VSGT_MODULE.GTA || params.module; // Only the google-translate-api module is used now
  if (true || module === 2) return gta.translate(text, params);
}

module.exports.translate = translate;
