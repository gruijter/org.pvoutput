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

module.exports = class MyApp extends Homey.App {

  async onInit() {
    // start time emitter and flow listeners
    this.every5minutes();
    this.registerFlowListeners();
    this.log('PVOutput app has been initialized');
  }

  async onUninit() {
    this.log('app onUninit called');
    this.homey.removeAllListeners('every5minutes');
  }

  every5minutes() {
    let timeoutId;
    const scheduleNext5minutes = () => {
      if (timeoutId) {
        this.homey.clearTimeout(timeoutId); // Clear any existing timeout
      }
      const now = new Date();
      const next5minutes = new Date(now);
      const currentMinutes = now.getMinutes();
      const nextMultipleOf5 = currentMinutes % 5 === 0 ? currentMinutes + 5 : Math.ceil(currentMinutes / 5) * 5;
      next5minutes.setMinutes(nextMultipleOf5, 0, 0);
      const timeToNext5minutes = next5minutes - now;
      // console.log('every5minutes starts in', timeToNext5minutes / 1000);
      timeoutId = this.homey.setTimeout(() => {
        const minutes = new Date(Date.now()).getMinutes();
        this.homey.emit('every5minutes', minutes);
        scheduleNext5minutes(); // Schedule the next 5 minutes
      }, timeToNext5minutes);
    };
    scheduleNext5minutes();
    this.log('every5minutes job started');
  }

  registerFlowListeners() {
    // trigger cards
    this._newInterval = this.homey.flow.getDeviceTriggerCard('new_interval');
    this.triggerNewInterval = (device, tokens, state) => {
      this._newInterval
        .trigger(device) // , tokens, state)
        // .then(this.log(device.getName(), tokens, state))
        .catch(this.error);
    };

    // action cards
    const sendData = this.homey.flow.getActionCard('send_data');
    sendData.registerRunListener((args) => args.device.sendData(args, 'flow'));
  }

};
