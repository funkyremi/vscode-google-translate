const t = require("./");

(async () => {
  console.log(await t.translate("test", { to: "ru" }));
})();
