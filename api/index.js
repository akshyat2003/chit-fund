import app from '../backend/dist/app.js';

export default function handler(req, res) {
  return app(req, res);
}
