/* photo.test.mjs - uploading a photograph of a CV.
 * A phone photo was refused on the live site: an iPhone saves HEIC, and the page only looked for
 * .png and .jpg, so the photo went down the plain-text path and failed with no offer to read it.
 * Run: node test/photo.test.mjs
 */
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + got : "")); }
};

/* the two small functions, lifted out of the page and run on their own */
const grab = (name) => {
  const m = new RegExp("function " + name + "\\(f\\)\\{[\\s\\S]*?\\n\\}").exec(html);
  if (!m) throw new Error(name + " not found in index.html");
  return m[0];
};
const ctx = vm.createContext({});
vm.runInContext(grab("isPicture") + "\n" + grab("pictureKind"), ctx);
const isPicture = (name, type) => vm.runInContext(`isPicture(${JSON.stringify({ name, type })})`, ctx);
const kind = (name, type) => vm.runInContext(`pictureKind(${JSON.stringify({ name, type })})`, ctx);

console.log("what counts as a photo");
ok("an iPhone photo (HEIC)", isPicture("IMG_4821.HEIC", "image/heic"));
ok("...even when the phone reports no type for it", isPicture("IMG_4821.heic", ""));
ok("an Android photo (WebP)", isPicture("photo.webp", "image/webp"));
ok("a JPG and a PNG, as before", isPicture("cv.jpg", "") && isPicture("cv.jpeg", "") && isPicture("cv.PNG", ""));
ok("a picture shared from another app with no extension at all", isPicture("image", "image/jpeg"));
ok("a PDF is not a photo", !isPicture("cv.pdf", "application/pdf"));
ok("a Word file is not a photo", !isPicture("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
ok("a text file is not a photo", !isPicture("cv.txt", "text/plain"));

console.log("\nthe file picker");
const accept = (/id="file" accept="([^"]*)"/.exec(html) || [])[1] || "";
ok("asks for images by type, so a phone offers its photo library and camera", accept.split(",").includes("image/*"), accept);
ok("names HEIC, the format an iPhone saves", /\.heic/.test(accept), accept);
ok("still takes PDF, Word and text", [".pdf", ".docx", ".txt"].every((x) => accept.includes(x)), accept);

console.log("\nwhat the applicant is told");
ok("a photo is read at once, not answered with a refusal first",
   /if\(READ_SCAN&&isPicture\(f\)\)\{await readNow\(\);return;\}/.test(html));
ok("the old red line that read like a refusal is gone",
   !/color:#b3261e">This file is a picture of your CV/.test(html));
ok("a format the browser cannot open is named in the message", kind("IMG_1.heic", "") === "HEIC" && kind("image", "image/avif") === "AVIF",
   kind("IMG_1.heic", "") + " / " + kind("image", "image/avif"));
ok("...and that message says what to do about it", /cannot open '\+esc\(err\.kind\)\+' pictures[\s\S]{0,200}screenshot/.test(html));
ok("the picture is opened before the reader is fetched, so that answer is immediate",
   html.indexOf("bmp=await createImageBitmap(f)") < html.indexOf("if(!window.Tesseract){") &&
   html.indexOf("bmp=await createImageBitmap(f)") > 0);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
