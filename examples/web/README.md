Loupedeck WebSerial Example
===========================

This example shows how to use the [WebSerial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) connector of the [`loupedeck`](https://www.npmjs.com/package/loupedeck) package to run a Loupedeck device in a browser.

It uses [Vite](https://github.com/vitejs/vite) & [Vue 3](https://github.com/vuejs/vue-next) as a build tool and framework, but these are not necessary to use WebSerial.

Requirements
------------

 * Node 20+
 * Supported Browsers
   * Google Chrome 89+
   * Microsoft Edge 89+
   * Opera 67+

Usage
-----

1. Install dependencies: `npm install`
2. Run local development server: `npm run dev`
3. Open [http://localhost:5173](http://localhost:5173) in a supported browser.

Deployment
----------

1. Bundle the application: `npm run build`
2. Make the contents of the `dist` directory accessible by a web server of your choice.

License
-------

MIT

