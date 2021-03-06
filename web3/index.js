// Copyright 2015-2017 Parity Technologies (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity.  If not, see <http://www.gnu.org/licenses/>.

/**
 * NOTE: This part is executed on embedded Parity Bar
 *
 * Since we are executing in context of chrome extension
 * we have access to chrome.* APIs
 */

import { createSecureTransport } from './secureTransport';
import { EV_SIGNER_BAR, EV_BAR_CODE, isIntegrationEnabled } from '../shared';
import Config from '../background/config';

isIntegrationEnabled()
  .then((enabled) => {
    if (enabled && window.location.protocol === 'chrome-extension:') {
      window.secureTransport = createSecureTransport();

      Config.get().then((config) => {
        window.backgroundSeed = config.backgroundSeed;
        loadScripts(config);
      });

      handleResizeEvents();
    }
  });

/**
 *  Propagates opening events to upper frame
 */
function handleResizeEvents () {
  document.body.addEventListener('parity.bar.visibility', (ev) => {
    document.querySelector('#container > div > div').style.maxHeight = '100vh';
    window.parent.postMessage({
      type: EV_SIGNER_BAR,
      opened: ev.detail.opened
    }, '*');
  });
}

/**
 * Loads ParityBar scripts from running node.
 */
function loadScripts (config) {
  // We need to use `port` here cause the response is asynchronous.
  const port = chrome.runtime.connect({ name: 'barScripts' });
  port.onMessage.addListener((code) => {
    if (!code.success) {
      const $loading = document.querySelector('#container .loading');
      const $link = document.createElement('a');
      $link.href = `${code.ui}/#/signer`;
      $link.target = '_blank';
      $link.innerHTML = 'Your Parity version is older than 1.5. <br />You need to open the UI to sign transactions.';

      $loading.classList.add('version');
      $loading.innerHTML = '';
      $loading.appendChild($link);
      return;
    }

    const $script = document.createElement('script');
    $script.src = code.scripts;
    document.body.appendChild($script);

    $script.addEventListener('load', () => {
      configureApi(config);
    });

    if (code.styles) {
      const $styles = document.createElement('link');
      $styles.rel = 'stylesheet';
      $styles.href = code.styles;
      document.head.appendChild($styles);
    }

    port.disconnect();
  });

  port.postMessage({
    type: EV_BAR_CODE
  });
}

function configureApi (config) {
  const { DAPPS } = config;

  const dappsInterface = DAPPS.split(':')[0];
  const dappsPort = DAPPS.split(':')[1];

  // Use the Secure API configure method if available
  if (window.secureApi && typeof window.secureApi.configure === 'function') {
    return window.secureApi.configure({
      dappsInterface, dappsPort
    });
  }

  if (dappsInterface) {
    window.secureApi._dappsInterface = dappsInterface;
  }

  if (dappsPort) {
    window.secureApi._dappsPort = dappsPort;
  }
}
