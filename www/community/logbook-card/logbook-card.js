class LogbookCard extends Polymer.Element {

  static get template() {
    return Polymer.html`
      <style>
        .content {
          cursor: pointer;
        }
        .item {
          font-size: 1.2em;
          clear: both;
          padding: 5px 0;
        }
        .duration {
          font-size: 0.85em;
          font-style: italic;
          float: right;
        }

        .date {
          font-size: 0.7em;
        }
      </style>
      <ha-card hass="[[_hass]]" config="[[_config]]">
        <template is="dom-if" if="{{title}}">
          <div class="card-header">
            <div class="name">[[title]]</div>  
          </div>
        </template>
        <div class="card-content grid" style="[[contentStyle]]">
          <div>
            <template is="dom-repeat" rendered-item-count="{{itemsCount}}" items="{{history}}">
              <div class="item">
                <template is="dom-if" if="{{_config.show.state}}"><span>[[item.state]]</span></template> 
                <template is="dom-if" if="{{_config.show.duration}}"><span class="duration">[[getDuration(item.duration)]]</span></template>
                <template is="dom-if" if="{{show.full_date}}"><div class="date"> [[_displayDate(item.start)]] - [[_displayDate(item.end)]]</div></template>
                <template is="dom-if" if="{{show.only_start_date}}"><div class="date">[[_displayDate(item.start)]]</div></template>
                <template is="dom-if" if="{{show.only_end_date}}"><div class="date">[[_displayDate(item.end)]]</div></template>
                </div>
            </template>

            <template is="dom-if" if="{{!itemsCount}}">
              [[_config.no_event]]
            </template>
          </div>
        </div>
        </ha-card>
    `;
  }

  getCardSize() {
    return 3;
  }

  _displayDate(date) {
    return date.toLocaleString(this._hass.language);
  }

  getDuration(durationInMs) {
    if (!durationInMs) {
      return '';
    }
    const durationInS = durationInMs / 1000;
    if (durationInS < 60) {
      return Math.round(durationInS) + 's';
    }
    const durationInMin = durationInS / 60;
    if (durationInMin < 60) {
      return Math.round(durationInMin) + 'm';
    }
    const durationInHours = durationInMin / 60;
    if (durationInHours < 24) {
      return Math.round(durationInHours) + 'h';
    }
    return Math.round(durationInHours / 24) + 'd';
  }

  setConfig(config) {
    const DEFAULT_SHOW = {
      state: true,
      duration: true,
      start_date: true,
      end_date: true,	
    };

    this._config = {
      history: 5,
      hiddenState: [],
      desc: true,
      no_event: 'No event on the period',
      max_items: -1,
      state_map: [],
      ...config,
      show: { ...DEFAULT_SHOW, ...config.show }
    };

    if (!config.entity) throw new Error('Please define an entity.');
    if (config.max_items !== undefined && !Number.isInteger(config.max_items)) throw new Error('Max_items must be an Integer.');
    if (config.hiddenState && !Array.isArray(config.hiddenState)) throw new Error('hiddenState must be an array'); 
    if (config.state_map && !Array.isArray(config.state_map)) throw new Error('state_map must be an array');
  }

  mapState(state) {
    var s = this._config.state_map.find(s => s.value === state);
    return s !== undefined && s.label ? s.label : state;
  }

  set hass(hass) {
    this._hass = hass;

    if (hass && this._config) {
      this.stateObj = this._config.entity in hass.states ? hass.states[this._config.entity] : null;

      const startDate = new Date(new Date().setDate(new Date().getDate() - this._config.history));

      const uri = 'history/period/' + startDate.toISOString() +
          '?filter_entity_id=' + this._config.entity +
          '&end_time=' + new Date().toISOString();

      this._hass.callApi('get', uri)
        .then(history => {
          this.history = history[0].map(hist => ({
            state: this.mapState(hist.state),
            start: new Date(hist.last_changed)
          }))
          .map((x, i, arr) => {
            if (i < arr.length - 1) {
                return {
                    ...x,
                    end: arr[i + 1].start
                }
            };
            return { ...x, end: new Date() }
          })
          .map(x => ({
            ...x,
            duration: x.end - x.start
          }))
          .filter(x => !this._config.hiddenState.includes(x.state));

          if (this._config.desc === true) {
            this.history = this.history.reverse();
          }

          if (this._config.max_items > 0) {
            this.history = this.history.splice(0, this._config.max_items);
          }
        });
      
      this.show = {
          only_start_date: this._config.show.start_date && !this._config.show.end_date,
          only_end_date: !this._config.show.start_date && this._config.show.end_date,
          full_date: this._config.show.start_date && this._config.show.end_date
      };

      if (this.stateObj) {
          this.title = this._config.title !== false && (this._config.title || this.stateObj.attributes.friendly_name + ' History');
      }
    }
  }
}

customElements.define('logbook-card', LogbookCard);