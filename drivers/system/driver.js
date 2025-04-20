/*
Copyright 2025, Robin de Gruijter (rmdegruijter@gmail.com)

This file is part of org.pvoutput.

org.pvoutput is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

org.pvoutput is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with org.pvoutput.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

const Homey = require('homey');
const PVOutputClient = require('../../pvoutput');

module.exports = class MyDriver extends Homey.Driver {

  async onInit() {
    this.log('System driver has been initialized');
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
        name: `${info.systemName}`,
        data: {
          id: `${systemId}`,
        },
        capabilities: [
          'meter_power',
          'measure_power',
        ],
        settings: {
          systemId,
          apiKey,
          systemName: info.systemName,
          systemSize: info.systemSize,
          interval: info.statusInterval || '5',
        },
      };
      return Promise.all([device]);
    });
  }

};
