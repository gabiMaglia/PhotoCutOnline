// Matchers extra de Testing Library (toBeInTheDocument, toBeDisabled, …).
require("@testing-library/jest-dom");

// jsdom no expone TextEncoder/TextDecoder en su global (a diferencia del
// runtime real de Node/navegador): lib/zip.js los usa para nombres de
// archivo UTF-8. Sin este polyfill, cualquier test que ejercite makeZip()
// bajo jsdom revienta con "TextEncoder is not defined".
const { TextEncoder, TextDecoder } = require("util");
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;
