import handler, { config } from './index';

export { config };
export default handler;

// Ensure compatibility with both ESM and CommonJS runtimes on Vercel
try {
  // @ts-ignore
  module.exports = handler;
  // @ts-ignore
  module.exports.default = handler;
  // @ts-ignore
  module.exports.config = config;
} catch (e) {}
