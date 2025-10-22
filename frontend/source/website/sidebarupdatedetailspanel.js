import { SubCoord3D } from '../engine/geometry/coord3d.js';
import { GetBoundingBox } from '../engine/model/modelutils.js';
import { AddDiv } from '../engine/viewer/domutils.js';
import { SidebarPanel } from './sidebarpanel.js';
import { Loc } from '../engine/core/localization.js';

export class SidebarUpdateDetailsPanel extends SidebarPanel
{
    constructor (parentDiv)
    {
        super (parentDiv);
        this.values = {}; // store editable values
    }

    GetName ()
    {
        return Loc('Update Parameter');
    }

    GetIcon ()
    {
        return 'settings';
    }

    AddObject3DProperties (model, object3D)
    {
        this.Clear();
        const table = AddDiv(this.contentDiv, 'ov_property_table');

        const boundingBox = GetBoundingBox(object3D);
        const size = SubCoord3D(boundingBox.max, boundingBox.min);

        // Editable fields for X/Y/Z
        this.AddEditableProperty(table, 'Size X', size.x, true);
        this.AddEditableProperty(table, 'Size Y', size.y, true);
        this.AddEditableProperty(table, 'Size Z', size.z, true);

        this.Resize();
    }

    // Creates a property row with editable button
    AddEditableProperty (table, label, value, editable)
    {
        const row = AddDiv(table, 'ov_property_table_row');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        AddDiv(row, 'ov_property_table_cell ov_property_table_name', label + ':');
        const valueCell = AddDiv(row, 'ov_property_table_cell ov_property_table_value');

        const button = document.createElement('button');
        const displayValue = this.FormatNumber(value);
        button.textContent = displayValue;
        button.className = 'ov_edit_button';
        button.style.width = '100%';
        button.style.height = '25px';
        button.style.textAlign = 'left';

        valueCell.appendChild(button);
        this.values[label] = value;

        if (editable) {
            button.addEventListener('click', () => {
                this.MakeEditable(button, label);
            });
        }
    }

    // Turns button into editable input
    MakeEditable (button, label)
    {
        const currentValue = parseFloat(button.textContent);
        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        input.step = '0.01'; // allows decimal editing
        input.style.width = '93%';
        input.style.height = '25px';
        input.className = 'ov_edit_input';

        button.replaceWith(input);
        input.focus();

        const saveValue = () => {
            const newValue = parseFloat(input.value);
            this.values[label] = newValue;
            input.replaceWith(button);
            button.textContent = this.FormatNumber(newValue);
        };

        input.addEventListener('blur', saveValue);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveValue();
            }
        });
    }

    // Format number to 2 decimal places
    FormatNumber (num)
    {
        if (typeof num !== 'number' || isNaN(num)) return num;
        return parseFloat(num.toFixed(2));
    }

    GetUpdatedValues ()
    {
        return this.values;
    }
}
