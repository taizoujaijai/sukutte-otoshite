// ビルドした dist/index.html を、Artifact として公開できる形（dist/artifact.html）に整える。
// Artifact は公開時に <!doctype>・<html>・<head>・<body> の枠を自動で付けるので、それらのタグを外す。
// 文字コードと viewport の meta も枠のほうに入っているので外す。
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist/index.html', 'utf8');
let out = src
  .replace(/<!doctype html>/i, '')
  .replace(/<html[^>]*>/i, '')
  .replace(/<\/html>/i, '')
  .replace(/<head>/i, '')
  .replace(/<\/head>/i, '')
  .replace(/<body>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta charset="utf-8">/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .trim();

// <title> は先頭 8KB 以内にある必要がある
const titleAt = out.indexOf('<title>');
if (titleAt < 0 || titleAt > 8000) throw new Error('<title> がファイルの先頭近くにありません');

writeFileSync('dist/artifact.html', out + '\n');
console.log(`dist/artifact.html: ${(out.length / 1024 / 1024).toFixed(2)} MB`);
