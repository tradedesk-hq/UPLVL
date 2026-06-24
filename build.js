// Build the standalone drop-in: inline style.css + app.js + cloud.js into index.html → uplvl.html.
// The Supabase CDN <script> stays external. Run: node build.js
const fs = require("fs");
const path = require("path");
const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");

let html = read("index.html");
const css = read("style.css");
const app = read("app.js");
const cloud = read("cloud.js");

html = html.replace(
  '<link rel="stylesheet" href="style.css" />',
  "<style>\n" + css + "\n</style>"
);
html = html.replace(
  '<script src="app.js"></script>',
  "<script>\n" + app + "\n</script>"
);
html = html.replace(
  '<script src="cloud.js"></script>',
  "<script>\n" + cloud + "\n</script>"
);

fs.writeFileSync(path.join(dir, "uplvl.html"), html);
console.log("✓ uplvl.html rebuilt (" + html.length + " bytes)");
