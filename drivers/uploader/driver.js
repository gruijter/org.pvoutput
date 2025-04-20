'use strict';

const { Driver } = require('homey');
const PVOutputClient = require('../../pvoutput');

class PVOutputDriver extends Driver {

  async onInit() {
    this.log('Uploader driver has been initialized');
  }

  async onPair(session) {
    let systemId = '';
    let apiKey = '';
    let info = null;

    session.setHandler('login', async (data) => {
      systemId = data.username;
      apiKey = data.password;
      this.api = new PVOutputClient({ systemId, apiKey });
      info = await this.api.getSystem().catch(this.error);
      return info;
    });

    session.setHandler('list_devices', async () => {
      if (!info) throw Error('No system registered');
      const device = {
        name: `${info.systemName} ${info.systemSize}W`,
        data: {
          id: `${systemId}`,
        },
        capabilities: [],
        settings: {
          systemId,
          apiKey,
          systemName: info.systemName,
          systemSize: info.systemSize,
        },
      };
      return Promise.all([device]);
    });
  }
}

module.exports = PVOutputDriver;
