import ClassSystemUtil from '../../util/ClassSystem.mjs';
import List            from '../../list/Base.mjs';
import Picker          from './Picker.mjs';
import Store           from '../../data/Store.mjs';
import VDomUtil        from '../../util/VDom.mjs';

/**
 * Provides a drop down list to select one or multiple items
 * @class Neo.form.field.Select
 * @extends Neo.form.field.Picker
 */
class Select extends Picker {
    static getConfig() {return {
        /**
         * @member {String} className='Neo.form.field.Select'
         * @protected
         */
        className: 'Neo.form.field.Select',
        /**
         * @member {String} ntype='selectfield'
         * @protected
         */
        ntype: 'selectfield',
        /**
         * @member {String[]} cls=['neo-selectfield','neo-pickerfield','neo-textfield']
         */
        cls: ['neo-selectfield', 'neo-pickerfield', 'neo-textfield'],
        /**
         * @member {String} displayField='name'
         */
        displayField: 'name',
        /**
         * True will only fire a change event, in case the TextField input value matches a record.
         * onFocusLeave() will try to select a hint record, if needed and possible.
         * @member {Boolean} forceSelection=false
         */
        forceSelection: false,
        /**
         * @member {String|Number|null} hintRecordId=null
         */
        hintRecordId: null,
        /**
         * Additional used keys for the selection model
         * @member {Object} keys
         */
        keys: {
            Down  : 'onKeyDownDown',
            Enter : 'onKeyDownEnter',
            Escape: 'onKeyDownEscape',
            Right : 'onKeyDownRight',
            Up    : 'onKeyDownUp'
        },
        /**
         * @member {String|null} lastManualInput=null
         * @protected
         */
        lastManualInput: null,
        /**
         * @member {Neo.list.Base} list=null
         * @protected
         */
        list: null,
        /**
         * @member {Object|null} listConfig=null
         */
        listConfig: null,
        /**
         * The height of the picker container. Defaults to px.
         * @member {Number|null} pickerHeight=null
         */
        pickerHeight: null,
        /**
         * @member {Object} record=null
         * @protected
         */
        record: null,
        /**
         * @member {Neo.data.Store|null} store_=null
         */
        store_: null,
        /**
         * Display the first matching result while typing
         * @member {Boolean} typeAhead_=true
         */
        typeAhead_: true
    }}

    /**
     *
     * @param {Object} config
     */
    constructor(config) {
        super(config);

        let me = this;

        me.list = Neo.create({
            module        : List,
            appName       : me.appName,
            displayField  : me.displayField,
            parentId      : me.id,
            selectionModel: {stayInList: false},
            silentSelect  : true,
            store         : me.store,
            ...me.listConfig
        });

        me.list.keys._keys.push(
            {fn: 'onContainerKeyDownEnter',  key: 'Enter',  scope: me.id},
            {fn: 'onContainerKeyDownEscape', key: 'Escape', scope: me.id}
        );

        me.list.on({
            createItems       : me.onListCreateItems,
            itemClick         : me.onListItemClick,
            itemNavigate      : me.onListItemNavigate,
            selectPostLastItem: me.focusInputEl,
            selectPreFirstItem: me.focusInputEl,
            scope             : me
        });

        me.typeAhead && me.updateTypeAhead();
    }

    /**
     * Triggered after the store config got changed
     * @param {Neo.data.Store} value
     * @param {Neo.data.Store} oldValue
     * @protected
     */
    afterSetStore(value, oldValue) {
        let me = this,
            filters;

        if (value) {
            filters = value.filters || [];

            filters.push({
                includeEmptyValues: true,
                operator          : 'like',
                property          : me.displayField,
                value             : value.get(me.value)?.[me.displayField] || me.value
            });

            value.filters = filters;
        }
    }

    /**
     * Triggered after the typeAhead config got changed
     * @param {Boolean} value
     * @param {Boolean} oldValue
     * @protected
     */
    afterSetTypeAhead(value, oldValue) {
        this.rendered && this.updateTypeAhead();
    }

    /**
     * Triggered after the value config got changed
     * @param {Number|String|null} value
     * @param {Number|String|null} oldValue
     * @param {Boolean} [preventFilter=false]
     * @protected
     */
    afterSetValue(value, oldValue, preventFilter=false) {
        let list = this.list;

        list && (list.silentVdomUpdate = true);
        !preventFilter && this.updateValue(true);
        list && (list.silentVdomUpdate = false);

        super.afterSetValue(value, oldValue);
    }

    /**
     * Gets triggered before getting the value of the value config
     * @param {Number|String|null} value
     * @returns {Number|Object|String}
     */
    beforeGetValue(value) {
        return this.record || value;
    }

    /**
     * Triggered before the store config gets changed.
     * @param {Object|Neo.data.Store|null} value
     * @param {Neo.data.Store} oldValue
     * @returns {Neo.data.Store}
     * @protected
     */
    beforeSetStore(value, oldValue) {
        oldValue && oldValue.destroy();

        return ClassSystemUtil.beforeSetInstance(value, Store);
    }

    /**
     * Triggered before the value config gets changed.
     * @param {Number|String|null} value
     * @param {Number|String|null} oldValue
     * @returns {Number|String|null}
     * @protected
     */
    beforeSetValue(value, oldValue) {
        let me           = this,
            displayField = me.displayField;

        if (Neo.isObject(value)) {
            me.record = value;
            return value[displayField];
        }

        me.record = me.store.find(displayField, value)[0] || null;

        return value;
    }

    /**
     *
     * @returns {Neo.list.Base}
     */
    createPickerComponent() {
        return this.list;
    }

    /**
     * Overrides form.field.Base
     * @param {*} value
     * @param {*} oldValue
     * @override
     */
    fireChangeEvent(value, oldValue) {
        let me     = this,
            record = me.record;

        if (!(me.forceSelection && !record)) {
            me.fire('change', {
                component: me,
                oldValue : me.store.get(oldValue) ? oldValue : null,
                value    : record || value
            });
        }
    }

    /**
     *
     * @param {Function} [callback]
     */
    focusInputEl(callback) {
        let me = this;

        me.updateTypeAheadValue(me.lastManualInput, true);
        me.value = me.lastManualInput;

        Neo.main.DomAccess.focus({
            id: me.getInputElId()
        }).then(() => {
            callback?.apply(me);
        });
    }

    /**
     *
     * @returns {Object}
     */
    getInputHintEl() {
        let el = VDomUtil.findVdomChild(this.vdom, this.getInputHintId());
        return el?.vdom;
    }

    /**
     *
     * @returns {String}
     */
    getInputHintId() {
        return this.id + '__input-hint'
    }

    /**
     * Returns the first selected record or null
     * returns {Object}
     */
    getRecord() {
        let list      = this.list,
            recordKey = list.selectionModel.getSelection()[0];

        return recordKey && this.store.get(list.getItemRecordId(recordKey)) || null;
    }

    /**
     * @param {Object} data
     * @protected
     */
    onContainerKeyDownEnter(data) {
        this.hidePicker();
    }

    /**
     * @param {Object} data
     * @protected
     */
    onContainerKeyDownEscape(data) {
        this.focusInputEl(this.hidePicker);
    }

    /**
     * @param {Object} data
     * @protected
     */
    onInputValueChange(data) {
        super.onInputValueChange(data);
        this.lastManualInput = data.value;
    }

    /**
     *
     * @param {Object} data
     * @protected
     */
    onKeyDownDown(data) {
        this.onKeyDownEnter(data);
    }

    /**
     *
     * @param {Object} data
     * @protected
     */
    onKeyDownEnter(data) {
        let me    = this;

        if (me.pickerIsMounted) {
            me.selectListItem();
            super.onKeyDownEnter(data);
        } else {
            super.onKeyDownEnter(data, me.selectListItem);
        }
    }

    /**
     *
     * @param {Object} data
     * @protected
     */
    onKeyDownRight(data) {
        let me = this;

        if (me.hintRecordId) {
            me.value = me.store.get(me.hintRecordId)[me.displayField];
        }
    }

    /**
     *
     * @param {Object} data
     * @protected
     */
    onKeyDownUp(data) {
        let me = this;

        if (me.pickerIsMounted) {
            me.selectLastListItem();
            super.onKeyDownEnter(data);
        } else {
            super.onKeyDownEnter(data, me.selectLastListItem);
        }
    }

    /**
     * @protected
     */
    onListCreateItems() {
        let me = this;
        me.typeAhead && me.picker?.mounted && me.updateTypeAheadValue();
    }

    /**
     *
     * @param {Object} record
     * @protected
     */
    onListItemClick(record) {
        let me       = this,
            oldValue = me.value,
            value    = record[me.displayField];

        if (me.value !== value) {
            me.hintRecordId = null;
            me.record       = record;
            me._value       = value;
            me.getInputHintEl().value = null;

            me.afterSetValue(value, oldValue, true); // prevent the list from getting filtered

            me.fire('select', {
                record: record,
                value : record[me.store.keyProperty]
            });
        }
    }

    /**
     *
     * @param {Object} record
     * @protected
     */
    onListItemNavigate(record) {
        this.onListItemClick(record);
    }

    /**
     *
     */
    selectFirstListItem() {
        this.selectListItem(0);
    }

    /**
     *
     */
    selectLastListItem() {
        this.selectListItem(this.store.getCount() -1);
    }

    /**
     * If no index is passed, the index matching to the field input will get used (0 if none)
     * @param {Number} [index]
     */
    selectListItem(index) {
        let me = this;

        if (!Neo.isNumber(index)) {
            if (me.hintRecordId) {
                index = me.store.indexOfKey(me.hintRecordId);
            } else {
                index = 0;
            }
        }

        me.list.selectItem(index);
        me.onListItemNavigate(me.store.getAt(index));
    }

    /**
     * @param {Boolean} [silent=false]
     * @protected
     */
    updateTypeAhead(silent=false) {
        let me      = this,
            inputEl = VDomUtil.findVdomChild(me.vdom, {flag: 'neo-real-input'}),
            vdom    = me.vdom;

        if (me.typeAhead) {
            inputEl.parentNode.cn[inputEl.index] = {
                tag: 'span',
                cls: ['neo-input-field-wrapper'],
                cn : [{
                    tag         : 'input',
                    autocomplete: 'off',
                    autocorrect : 'off',
                    cls         : ['neo-textfield-input', 'neo-typeahead-input'],
                    id          : me.getInputHintId(),
                    spellcheck  : 'false'
                }, inputEl.vdom]
            }
        } else {
            VDomUtil.replaceVdomChild(vdom, inputEl.parentNode.id, inputEl.vdom);
        }

        me[silent ? '_vdom' : 'vdom'] = vdom;
    }

    /**
     * @param {String|null} [value=this.value]
     * @param {Boolean} [silent=false]
     * @protected
     */
    updateTypeAheadValue(value=this._value, silent=false) {
        let me          = this,
            hasMatch    = false,
            store       = me.store,
            i           = 0,
            len         = store.getCount(),
            vdom        = me.vdom,
            inputHintEl = me.getInputHintEl(),
            storeValue;

        if (!me.record && value && value.length > 0) {
            for (; i < len; i++) {
                storeValue = store.items[i][me.displayField];

                if (storeValue.toLowerCase().indexOf(value.toLowerCase()) === 0) {
                    hasMatch = true;
                    break;
                }
            }

            if (hasMatch && inputHintEl) {
                inputHintEl.value = value + storeValue.substr(value.length);
                me.hintRecordId = store.items[i][store.keyProperty || store.model.keyProperty];
            }
        }

        if (!hasMatch && inputHintEl) {
            inputHintEl.value = '';
            me.hintRecordId = null;
        }

        me[silent ? '_vdom' : 'vdom'] = vdom;
    }

    /**
     * @param {Boolean} [silent=false]
     * @protected
     */
    updateValue(silent=false) {
        let me           = this,
            displayField = me.displayField,
            store        = me.store,
            value        = me._value,
            record       = me.record,
            filter;

        if (store && !Neo.isEmpty(store.filters)) {
            filter = store.getFilter(displayField);

            if (filter) {
                filter.value = record ? record[displayField] : value;
            }
        }

        if (me.typeAhead && !me.picker?.containsFocus) {
            me.updateTypeAheadValue(silent);
        }
    }
}

/**
 * The select event fires when a list item gets selected
 * @event select
 * @param {Object} record
 * @param {value} record[store.keyProperty]
 * @returns {Object}
 */

Neo.applyClassConfig(Select);

export {Select as default};
