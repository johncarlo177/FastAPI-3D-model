import { RunTaskAsync } from '../engine/core/taskrunner.js';
import { SubCoord3D } from '../engine/geometry/coord3d.js';
import { GetBoundingBox } from '../engine/model/modelutils.js';
import { Property, PropertyToString, PropertyType } from '../engine/model/property.js';
import { AddDiv, AddDomElement, ClearDomElement } from '../engine/viewer/domutils.js';
import { SidebarPanel } from './sidebarpanel.js';
import { CreateInlineColorCircle } from './utils.js';
import { GetFileName, IsUrl } from '../engine/io/fileutils.js';
import { MaterialSource, MaterialType } from '../engine/model/material.js';
import { RGBColorToHexString } from '../engine/model/color.js';
import { Unit } from '../engine/model/unit.js';
import { Loc } from '../engine/core/localization.js';
import axiosInstance from './axios.js';

function UnitToString(unit) {
    switch (unit) {
        case Unit.Millimeter:
            return Loc('Millimeter');
        case Unit.Centimeter:
            return Loc('Centimeter');
        case Unit.Meter:
            return Loc('Meter');
        case Unit.Inch:
            return Loc('Inch');
        case Unit.Foot:
            return Loc('Foot');
    }
    return Loc('Unknown');
}

export class SidebarUpdateDetailsPanel extends SidebarPanel {
    constructor(parentDiv) {
        super(parentDiv);
        this.currentModel = null;
        this.currentObject = null;
        this.currentMaterial = null;
        this.allProperties = [];
    }

    GetName() {
        return Loc('Update Properties');
    }

    GetIcon() {
        return 'settings';
    }

    AddObject3DProperties(model, object3D, result) {
        this.Clear();
        this.currentModel = model;
        this.currentObject = object3D;
        this.allProperties = [];

        this.result = result;
        this.lastResultJson = result.json;
        this.originalJson = JSON.parse(JSON.stringify(result.json));

        let table = AddDiv(this.contentDiv, 'ov_property_table');
        let boundingBox = GetBoundingBox(object3D);
        let size = SubCoord3D(boundingBox.max, boundingBox.min);
        let unit = model.GetUnit();

        this.AddProperty(table, new Property(PropertyType.Integer, Loc('Vertices'), object3D.VertexCount()), false);
        let lineSegmentCount = object3D.LineSegmentCount();
        if (lineSegmentCount > 0) {
            this.AddProperty(table, new Property(PropertyType.Integer, Loc('Lines'), lineSegmentCount), false);
        }
        let triangleCount = object3D.TriangleCount();
        if (triangleCount > 0) {
            this.AddProperty(table, new Property(PropertyType.Integer, Loc('Triangles'), triangleCount), false);
        }
        if (unit !== Unit.Unknown) {
            this.AddProperty(table, new Property(PropertyType.Text, Loc('Unit'), UnitToString(unit)), false);
        }
        this.AddProperty(table, new Property(PropertyType.Number, Loc('Size X'), size.x), false);
        this.AddProperty(table, new Property(PropertyType.Number, Loc('Size Y'), size.y), false);
        this.AddProperty(table, new Property(PropertyType.Number, Loc('Size Z'), size.z), false);

        if (object3D.PropertyGroupCount() > 0) {
            let customTable = AddDiv(this.contentDiv, 'ov_property_table ov_property_table_custom');
            for (let i = 0; i < object3D.PropertyGroupCount(); i++) {
                const propertyGroup = object3D.GetPropertyGroup(i);
                this.AddPropertyGroup(customTable, propertyGroup);
                for (let j = 0; j < propertyGroup.PropertyCount(); j++) {
                    const property = propertyGroup.GetProperty(j);
                    this.AddPropertyInGroup(customTable, property);
                }
            }
        }

        // show parameters from backend
        const json = result.json;
        if (Array.isArray(json)) {
            // Filter items: name includes "Extrude" and dimensions > 2
            const extrudes = json.filter(item =>
                item.name && item.name.includes('Extrude') &&
                Array.isArray(item.dimensions) && item.dimensions.length > 2
            );

            if (extrudes.length > 0) {
                const extrudeTable = AddDiv(this.contentDiv, 'ov_property_table ov_property_table_custom');

                extrudes.forEach(item => {
                    // Add name as a group header
                    this.AddPropertyGroup(extrudeTable, { name: item.name });

                    // Add each dimension
                    item.dimensions.forEach(dim => {
                        if (dim && typeof dim.value === 'number') {
                            const scaledValue = dim.value * 1000;

                            const property = new Property(PropertyType.Number, dim.name, scaledValue);
                            property._dimRef = dim;
                            this.AddPropertyInGroup(extrudeTable, property, true);
                        }
                    });
                });
            } else {
                console.warn('No Extrude items with more than 2 dimensions found.');
            }
        }

        this.AddActionButtons();
        this.Resize();
    }

    AddMaterialProperties(material) {
        this.Clear();
        this.currentMaterial = material;
        this.allProperties = [];

        const AddTextureMap = (obj, table, name, map) => {
            if (map === null || map.name === null) {
                return;
            }
            let fileName = GetFileName(map.name);
            obj.AddProperty(table, new Property(PropertyType.Text, name, fileName));
        };

        let table = AddDiv(this.contentDiv, 'ov_property_table');
        let typeString = null;
        if (material.type === MaterialType.Phong) {
            typeString = Loc('Phong');
        } else if (material.type === MaterialType.Physical) {
            typeString = Loc('Physical');
        }
        let materialSource = (material.source !== MaterialSource.Model) ? Loc('Default') : Loc('Model');
        this.AddProperty(table, new Property(PropertyType.Text, Loc('Source'), materialSource));
        this.AddProperty(table, new Property(PropertyType.Text, Loc('Type'), typeString));

        if (material.vertexColors) {
            this.AddProperty(table, new Property(PropertyType.Text, Loc('Color'), Loc('Vertex colors')));
        } else {
            this.AddProperty(table, new Property(PropertyType.Color, Loc('Color'), material.color));
            if (material.type === MaterialType.Phong) {
                this.AddProperty(table, new Property(PropertyType.Color, Loc('Ambient'), material.ambient));
                this.AddProperty(table, new Property(PropertyType.Color, Loc('Specular'), material.specular));
            }
        }
        if (material.type === MaterialType.Physical) {
            this.AddProperty(table, new Property(PropertyType.Percent, Loc('Metalness'), material.metalness));
            this.AddProperty(table, new Property(PropertyType.Percent, Loc('Roughness'), material.roughness));
        }
        this.AddProperty(table, new Property(PropertyType.Percent, Loc('Opacity'), material.opacity));

        AddTextureMap(this, table, Loc('Diffuse Map'), material.diffuseMap);
        AddTextureMap(this, table, Loc('Bump Map'), material.bumpMap);
        AddTextureMap(this, table, Loc('Normal Map'), material.normalMap);
        AddTextureMap(this, table, Loc('Emissive Map'), material.emissiveMap);
        if (material.type === MaterialType.Phong) {
            AddTextureMap(this, table, Loc('Specular Map'), material.specularMap);
        } else if (material.type === MaterialType.Physical) {
            AddTextureMap(this, table, Loc('Metallic Map'), material.metalnessMap);
        }

        this.AddActionButtons();
        this.Resize();
    }

    AddPropertyGroup(table, propertyGroup) {
        let row = AddDiv(table, 'ov_property_table_row group', propertyGroup.name);
        row.setAttribute('title', propertyGroup.name);
    }

    AddProperty(table, property, editable = true) {
        let row = AddDiv(table, 'ov_property_table_row');
        let nameColumn = AddDiv(row, 'ov_property_table_cell ov_property_table_name', property.name + ':');
        let valueColumn = AddDiv(row, 'ov_property_table_cell ov_property_table_value');
        nameColumn.setAttribute('title', property.name);
        nameColumn.style.width = '45%';
        valueColumn.style.width = '45%';
        this.DisplayPropertyValue(property, valueColumn);

        if (editable) {
            // Add Edit Button
            let editButton = AddDiv(row, 'ov_property_table_cell ov_property_table_edit');
            editButton.style.cursor = 'pointer';
            editButton.title = 'Edit this property';

            const svgImg = document.createElement('img');
            svgImg.src = '/assets/icons/marker-solid-full.svg'; 
            svgImg.style.width = '20px';
            svgImg.style.height = '20px';
            editButton.appendChild(svgImg);

            editButton.addEventListener('click', () => {
                this.MakePropertyEditable(property, valueColumn, editButton);
            });
        }

        property._originalValue = property.value;
        this.allProperties.push(property);
        return row;
    }


    AddPropertyInGroup(table, property, editable = true) {
        let row = this.AddProperty(table, property, editable);
        row.classList.add('ingroup');
    }

    AddCalculatedProperty(table, name, calculateValue) {
        let row = AddDiv(table, 'ov_property_table_row');
        let nameColumn = AddDiv(row, 'ov_property_table_cell ov_property_table_name', name + ':');
        let valueColumn = AddDiv(row, 'ov_property_table_cell ov_property_table_value');
        nameColumn.setAttribute('title', name);

        let calculateButton = AddDiv(valueColumn, 'ov_property_table_button', Loc('Calculate...'));
        calculateButton.addEventListener('click', () => {
            ClearDomElement(valueColumn);
            valueColumn.innerHTML = Loc('Please wait...');
            RunTaskAsync(() => {
                let propertyValue = calculateValue();
                if (propertyValue === null) {
                    valueColumn.innerHTML = '-';
                } else {
                    this.DisplayPropertyValue(propertyValue, valueColumn);
                }
            });
        });
    }

    MakePropertyEditable(property, valueColumn, editButton) {
        const img = editButton.querySelector('img'); // get the existing img

        const enterEditMode = () => {
            ClearDomElement(valueColumn);

            let inputEl;
            if (
                property.type === PropertyType.Number ||
                property.type === PropertyType.Percent ||
                property.type === PropertyType.Integer
            ) {
                inputEl = document.createElement('input');
                inputEl.type = 'number';
                inputEl.value = property.value;
            } else if (property.type === PropertyType.Text) {
                inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.value = property.value;
            } else if (property.type === PropertyType.Color) {
                inputEl = document.createElement('input');
                inputEl.type = 'color';
                inputEl.value = '#' + RGBColorToHexString(property.value);
            } else {
                inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.value = property.value;
            }

            inputEl.style.width = '90%';
            valueColumn.appendChild(inputEl);
            inputEl.focus();

            inputEl.addEventListener('input', () => {
                property.value = inputEl.value;
            });

            inputEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    exitEditMode();
                }
            });

            inputEl.addEventListener('blur', () => {
                setTimeout(() => {
                    if (document.activeElement !== editButton) {
                        exitEditMode();
                    }
                }, 100);
            });

            // hide the icon while editing
            if (img) img.style.display = 'none';
            editButton.onclick = exitEditMode;
        };

        const exitEditMode = () => {
            this.DisplayPropertyValue(property, valueColumn);

            if (property._dimRef) {
                property._dimRef.value = parseFloat(property.value) / 1000;
            }

            // show marker again
            if (img) img.style.display = 'block';
            editButton.onclick = enterEditMode;
        };

        // initial binding
        if (img) img.style.display = 'block';
        editButton.onclick = enterEditMode;
    }

    DisplayPropertyValue(property, targetDiv) {
        ClearDomElement(targetDiv);
        let valueHtml = null;
        let valueTitle = null;

        if (property.type === PropertyType.Text) {
            if (IsUrl(property.value)) {
                valueHtml = `<a target="_blank" href="${property.value}">${property.value}</a>`;
                valueTitle = property.value;
            } else {
                valueHtml = PropertyToString(property);
            }
        } else if (property.type === PropertyType.Color) {
            let hexString = '#' + RGBColorToHexString(property.value);
            let colorCircle = CreateInlineColorCircle(property.value);
            targetDiv.appendChild(colorCircle);
            AddDomElement(targetDiv, 'span', null, hexString);
        } else {
            valueHtml = PropertyToString(property);
        }

        if (valueHtml !== null) {
            targetDiv.innerHTML = valueHtml;
            targetDiv.setAttribute('title', valueTitle !== null ? valueTitle : valueHtml);
        }
    }

    AddActionButtons() {
        const buttonContainer = AddDiv(this.contentDiv, 'ov_action_buttons');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';

        const resetButton = AddDiv(buttonContainer, 'ov_button reset', 'Reset');
        resetButton.style.width = '45%';
        resetButton.addEventListener('click', () => {
            this.ResetProperties();
        });

        const saveButton = AddDiv(buttonContainer, 'ov_button save', 'Save');
        saveButton.style.width = '45%';
        saveButton.addEventListener('click', () => {
            this.SaveProperties();
        });
    }

    ResetProperties() {
        if (!this.originalJson) {
            alert('No original data to reset.');
            return;
        }

        // Restore the JSON to original
        this.lastResultJson = JSON.parse(JSON.stringify(this.originalJson));

        // Re-render the panel with original values
        this.RefreshPanel();
    }

    async SaveProperties() {
        // Remove any previous warning
        let existingWarning = this.contentDiv.querySelector('.save-warning');
        if (existingWarning) existingWarning.remove();

        try {
            if (!this.lastResultJson) {
                alert('No data to save.');
                return;
            }

            // Check if anything has changed
            const original = JSON.stringify(this.originalJson);
            const current = JSON.stringify(this.lastResultJson);

            if (original === current) {
                // Create red warning message with inline styles
                const warning = AddDiv(this.contentDiv, 'save-warning', 'You haven\'t changed anything!');
                Object.assign(warning.style, {
                    color: 'red',
                    fontSize: '14px',
                    textAlign: 'center',
                    marginBottom: '10px'
                });
                return;
            }

            // Proceed to save if changes exist
            const response = await axiosInstance.post('/api/update-model', {
                uuid: this.result.uuid,
                json: this.lastResultJson,
            });

            if (response.data.status === 'ok') {
                console.log(response.data, 'response');
                // Update originalJson to current state
                this.originalJson = JSON.parse(JSON.stringify(this.lastResultJson));
            } else {
                alert('Failed to save: ' + (response.data.message || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error saving properties:', error.response ? error.response.data : error.message);
            alert('Error saving properties. Check console for details.');
        }
    }


    RefreshPanel() {
        if (this.currentObject) {
            this.AddObject3DProperties(this.currentModel, this.currentObject, { json: this.lastResultJson || [] });
        } else if (this.currentMaterial) {
            this.AddMaterialProperties(this.currentMaterial);
        }
    }
}
