
    const { createServer } = require('http');
    const { parse } = require('url');
    const next = require('next');
    
    const dev = false;
    const hostname = 'localhost';
    const port = 3000;
    
    const nextApp = next({ dev, hostname, port });
    const handle = nextApp.getRequestHandler();
    
    nextApp.prepare().then(() => {
      createServer(async (req, res) => {
        try {
          const parsedUrl = parse(req.url, true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error('Error:', err);
          res.statusCode = 500;
          res.end('internal server error');
        }
      }).listen(port, () => {
        console.log(`> Next.js server ready on http://${hostname}:${port}`);
      });
    });
  