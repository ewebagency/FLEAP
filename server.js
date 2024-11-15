const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const httpsLocalhost = require('https-localhost')();

const app = next({ dev: true });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  httpsLocalhost.getCerts().then((certs) => {
    const server = createServer(certs, (req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    server.listen(3000, () => {
      console.log('> Server running on https://localhost:3000');
    });
  });
});
