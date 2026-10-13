import base from './vite.config.js';
export default (env) => { const c = base(env); return { ...c, css: { ...(c.css||{}), postcss: { plugins: [] } } }; };
