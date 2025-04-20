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
      this.busy = false;
      await this.startListeners();
      await this.setAvailable();
      await this.doPoll(); // initial poll
      this.log(this.getName(), 'has been initialized');
    } catch (error) {
      this.error(error);
      this.setUnavailable(error).catch(this.error);
      this.restarting = false;
      this.restartDevice(60 * 1000).catch((error) => this.error(error));
    }
  }

  async onUninit() {
    this.log('unInit', this.getName());
    this.unregisterListeners();
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

  async setCapability(capability, value) {
    if (this.hasCapability(capability) && value !== undefined) {
      await this.setCapabilityValue(capability, value).catch((error) => {
        this.log(error, capability, value);
      });
    }
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

  async doPoll() {
    try {
      if (!this.api) throw Error('API not initialized');
      await setTimeoutPromise(30 * 1000);
      const status = await this.api.getStatus();
      if (!status) throw Error('Status data not found');
      await this.handleDeviceData(status);
    } catch (error) {
      this.error(error);
    }
  }

  async handleDeviceData(status) {
    // console.dir(status, { depth: null });
    this.setCapability('measure_power', Number(status.powerGeneration)).catch((error) => this.error(error));
    this.setCapability('meter_power', Number(status.energyGeneration)).catch((error) => this.error(error));
    // // set settings that have changed
    // const newSettings = {
    //   systemId,
    //   apiKey,
    //   systemName,
    //   systemSize,
    //   interval,
    // };
    // for (const [key, value] of Object.entries(newSettings)) this.setSetting(key, value);
  }

  async startListeners() {
    this.unregisterListeners();
    // add listener for 5 minute trigger
    this.eventListener5minutes = (minute) => {
      this.doPoll().catch((error) => this.error(error));
    };
    this.homey.on('every5minutes', this.eventListener5minutes);
    this.log('listeners registered', this.getName());
  }

  unregisterListeners() {
    if (this.eventListener5minutes) {
      this.homey.removeListener('every5minutes', this.eventListener5minutes);
      this.log('unregistered 5 minute listener', this.getName());
    }
    this.eventListener5minutes = null;
  }

};
