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
const util = require('util');
const PVOutputClient = require('../../pvoutput');

const setTimeoutPromise = util.promisify(setTimeout);

module.exports = class MyDevice extends Homey.Device {

  async onInit() {
    try {
      this.settings = await this.getSettings();
      this.tz = this.homey.clock.getTimezone();
      const { systemId, apiKey } = this.settings;
      this.api = new PVOutputClient({ systemId, apiKey });
      this.restarting = false;
      await this.startListeners();
      await this.setAvailable();
      this.log(this.getName(), 'has been initialized');
    } catch (error) {
      this.error(error);
      this.setUnavailable(error).catch(this.error);
      this.restarting = false;
      this.restartDevice(60 * 1000).catch((error) => this.error(error));
    }
  }

  async onUninit() {
    this.unregisterListeners();
    this.log('unInit', this.getName());
  }

  async onAdded() {
    this.log('added', this.getName());
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed', this.getName(), newSettings);
    this.restartDevice(1000).catch((error) => this.error(error));
  }

  async onRenamed(name) {
    this.log('Device was renamed', name);
  }

  async onDeleted() {
    this.unregisterListeners();
    this.log('Device was deleted', this.getName());
  }

  async restartDevice(delay) {
    // this.destroyListeners();
    if (this.restarting) return;
    this.restarting = true;
    this.unregisterListeners();
    const dly = delay || 1000 * 5;
    this.log(`Device will restart in ${dly / 1000} seconds`);
    // this.setUnavailable(this.zigbee2MqttType, 'is restarting');
    await setTimeoutPromise(dly);
    this.onInit().catch((error) => this.error(error));
  }

  // setSetting(setting, value) {
  //   const settings = this.getSettings();
  //   if (settings && settings[setting] !== value) {
  //     const newSettings = {};
  //     newSettings[setting] = value;
  //     this.log('New setting:', newSettings);
  //     this.setSettings(newSettings).catch((error) => {
  //       this.log(error, setting, value);
  //     });
  //   }
  // }

  async sendData(args, source) {
    if (!this.api) throw Error('PVOutput is not connected');
    if ((Date.now() - this.lastUpload) < 2 * 60 * 1000) throw Error('Sending too fast. Wait at least 2 minutes.');
    const {
      power,
      meter,
      meterConsumption,
      voltage,
      temperature,
      notCummulative,
    } = args;
    if (this.lastArgs && Object.keys(args).every((key) => args[key] === this.lastArgs[key])) {
      return Promise.resolve(true);
    }
    this.lastArgs = args;
    this.log(`${this.getName()} sending ${power}W, ${meter}kWh, cum:${!notCummulative}, ${meterConsumption}kWh, ${voltage}V, ${temperature}°C by ${source}`);
    const status = {
      power,
      meter: meter * 1000,
      meterConsumption: meterConsumption * 1000,
      cumulative: !notCummulative,
      voltage,
      temperature,
      tz: this.tz,
    };
    await this.api.addStatus(status);
    this.lastUpload = Date.now();
    return Promise.resolve(true);
  }

  async startListeners() {
    this.unregisterListeners();
    this.eventListenerNewInterval = (minute) => {
      // const tokens = { minute };
      this.homey.app.triggerNewInterval(this);
    };
    this.homey.on('every5minutes', this.eventListenerNewInterval);
    this.log('listeners registered', this.getName());
  }

  unregisterListeners() {
    if (this.eventListenerNewInterval) {
      this.homey.removeListener('every5minutes', this.eventListenerNewInterval);
      this.log('unregistered new interval listener', this.getName());
    }
    this.eventListener5minutes = null;
  }

};
