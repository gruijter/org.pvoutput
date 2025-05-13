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

const https = require('https');
const querystring = require('node:querystring');

// API host
const defaultHost = 'pvoutput.org';
const defaultPort = 443;
const defaultTimeout = 20000;

// Endpoints
const getSystemEP = '/service/r2/getsystem.jsp';
const getStatusEP = '/service/r2/getstatus.jsp';
const addStatusEP = '/service/r2/addstatus.jsp';

const parseSystemData = (data) => {
  const fields = [
    'systemName', 'systemSize', 'postcode', 'panels', 'panelPower', 'panelBrand',
    'inverters', 'inverterPower', 'inverterBrand', 'orientation', 'arrayTilt',
    'shade', 'installDate', 'latitude', 'longitude', 'statusInterval',
    'secondaryPanels', 'secondaryPanelPower', 'secondaryOrientation',
    'secondaryArrayTilt', 'separator1', 'exportTariff', 'importPeakTariff',
    'importOffPeakTariff', 'importShoulderTariff', 'importHighShoulderTariff',
    'importDailyCharge', 'separator2', 'teams', 'separator3', 'donations',
    'separator4', 'extendedDataConfig', 'separator5', 'monthlyEstimations',
  ];
  const values = data.split(',');
  const result = {};
  fields.forEach((field, index) => {
    if (field.includes('separator')) return;
    result[field] = values[index] || null; // Assign null if the value is missing
  });
  return result;
};

const parseStatusData = (data) => {
  const values = data.includes(';') ? data.split(';')[0].split(',') : data.split(',');
  let fields = [];
  if (values.length === 9 || values.length === 15) {
    fields = [
      'date', 'time', 'energyGeneration', 'powerGeneration', 'energyConsumption', 'powerConsumption', 'normalizedoutput',
      'temperature', 'voltage', 'extendedV7', 'extendedV8', 'extendedV9', 'extendedV10', 'extendedV11', 'extendedV12',
    ];
  } else if (values.length === 11 || values.length === 17) { // when using h = 1
    fields = [
      'date', 'time', 'energyGeneration', 'energyEfficiency', 'instantaneousPower', 'averagePower', 'normalizedoutput', 'energyConsumption', 'powerConsumption',
      'temperature', 'voltage', 'extendedV7', 'extendedV8', 'extendedV9', 'extendedV10', 'extendedV11', 'extendedV12',
    ];
  } else throw Error(`Unexpected data format: ${data}`);
  const result = {};
  fields.forEach((field, index) => {
    if (field.includes('separator')) return;
    result[field] = values[index] || null; // Assign null if the value is missing
  });
  return result;
};

const pad = (num, size) => num.toString().padStart(size, '0');

// Represents a session to a PVOutput system.
class PVOutputClient {

  constructor(opts) {
    const options = opts || {};
    // this.email = options.email;
    // this.password = options.password;
    this.host = defaultHost;
    this.port = defaultPort;
    this.timeout = options.timeout || defaultTimeout;
    this.apiKey = options.apiKey;
    this.systemId = options.systemId;
    this.lastResponse = undefined;
  }

  async getSystem(opts) {
    try {
      const queery = { array2: 1 };
      if (opts) Object.assign(queery, opts);
      const res = await this._makeRequest(`${getSystemEP}?${querystring.stringify(queery)}`);
      const systemInfo = parseSystemData(res);
      return Promise.resolve(systemInfo);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async getStatus(opts) {
    try {
      const queery = {};
      if (opts) Object.assign(queery, opts);
      const res = await this._makeRequest(`${getStatusEP}?${querystring.stringify(queery)}`);
      const statusInfo = parseStatusData(res);
      return Promise.resolve(statusInfo);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async addStatus(opts) {
    try {
      const values = opts || {};
      const timestamp = new Date();
      const date = `${timestamp.getFullYear()}${pad(timestamp.getMonth() + 1, 2)}${pad(timestamp.getDate(), 2)}`;
      const time = timestamp.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: values.tz || 'Europe/Amsterdam',
      });
      const queery = {
        d: date,
        t: time,
      };
      if (values.meter != null && values.meter !== undefined) queery.v1 = values.meter;
      if (values.power != null && values.power !== undefined) queery.v2 = values.power;
      if (values.powerConsumption != null && values.powerConsumption !== undefined) queery.v3 = values.powerConsumption;
      if (values.temperature != null && values.temperature !== undefined) queery.v5 = values.temperature;
      if (values.voltage != null && values.voltage !== undefined) queery.v6 = values.voltage;
      if (values.cumulative != null && values.cumulative !== undefined) queery.c1 = values.cumulative ? 1 : 0;
      const res = await this._makeRequest(`${addStatusEP}?${querystring.stringify(queery)}`);
      return Promise.resolve(res);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async addNetStatus(opts) {
    try {
      const values = opts || {};
      const timestamp = new Date();
      const date = `${timestamp.getFullYear()}${pad(timestamp.getMonth() + 1, 2)}${pad(timestamp.getDate(), 2)}`;
      const time = timestamp.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: values.tz || 'Europe/Amsterdam',
      });
      const queery = {
        d: date,
        t: time,
        v2: values.powerExported,
        v4: values.powerImported,
        n: 1,
      };
      const res = await this._makeRequest(`${addStatusEP}?${querystring.stringify(queery)}`);
      return Promise.resolve(res);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async _makeRequest(actionPath, data, timeout, method) {
    try {
      const postData = JSON.stringify(data);
      const headers = {
        // 'Content-Type': 'application/x-www-form-urlencoded',
        'X-Pvoutput-Apikey': this.apiKey,
        'X-Pvoutput-SystemId': this.systemId,
      };
      const options = {
        hostname: this.host,
        port: this.port,
        path: actionPath,
        headers,
        method: 'GET',
      };
      if (data && data !== '') options.method = 'POST';
      if (method) options.method = method;
      const result = await this._makeHttpsRequest(options, postData, timeout);
      this.lastResponse = result.body || result.statusCode;
      const contentType = result.headers['content-type'];
      // find errors
      if (result['x-rate-limit-remaining'] <= 0) throw Error('Rate limit exceeded');
      if (result.statusCode !== 200) {
        this.lastResponse = result.body || result.statusCode;
        throw Error(`HTTP request Failed. ${this.lastResponse}`);
      }
      if (!/text\/plain/.test(contentType)) {
        throw Error(`Expected text but received ${contentType}: ${result.body}`);
      }
      // console.dir(result.body, { depth: null });
      return Promise.resolve(result.body);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  _makeHttpsRequest(options, postData, timeout) {
    return new Promise((resolve, reject) => {
      const opts = options;
      opts.timeout = timeout || this.timeout;
      const req = https.request(opts, (res) => {
        let resBody = '';
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.once('end', () => {
          this.lastResponse = resBody;
          if (!res.complete) {
            return reject(Error('The connection was terminated while the message was still being sent'));
          }
          res.body = resBody;
          return resolve(res);
        });
      });
      req.on('error', (e) => {
        req.destroy();
        this.lastResponse = e;
        return reject(e);
      });
      req.on('timeout', () => {
        req.destroy();
      });
      req.end(postData);
    });
  }

}

module.exports = PVOutputClient;
