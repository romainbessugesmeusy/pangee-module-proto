var product = {};
var formValue;
var dynamicFields = [];
var language = 'fr';

$(function () {

    var $dump = $('#dump');
    var $moduleChooser = $('#modules');
    var $languageChooser = $('#language');
    var currentModuleID;

    $.getJSON('panjee.json', function (entities) {

        $.each(entities, function (ID, entity) {
            if (entity.type === 'module') {
                $moduleChooser.append($('<option>').attr('value', ID).text(entity.title.fr));
            }
        });

        $moduleChooser.on('change', function () {
            renderModule($(this).val());
        });

        $languageChooser.on('change', function () {
            language = $(this).val();
            renderModule($moduleChooser.val());
        });

        function renderModule(moduleID) {
            currentModuleID = moduleID;
            var module = entities[moduleID];
            var $module = $('.module');

            if (typeof product[currentModuleID] === 'undefined') {
                product[currentModuleID] = {};
            }

            formValue = product[currentModuleID];

            dynamicFields.length = 0;
            $module.find('.title').text(module.title[language]);
            var $fields = $module.find('.fields').empty();
            $(module.fields).each(function (i, field) {
                $fields.append(createField(field));
            });
            valueDidChange();
        }

        function isReference(path) {
            return (path && path.substr(0, 1) === '[');
        }

        function isDynamicReference(path) {
            return (path && path.match(/\{(\w+)\}/g) !== null);
        }

        function resolveReference(path, cb, onError) {
            var ref = path.substr(1, path.length - 2);
            var replaced = ref.replace(/\{(\w+)\}/g, function (whole, part) {
                return formValue[part];
            });

            //console.info("resolveReference", path, replaced, entities[replaced]);

            if (typeof entities[replaced] !== 'undefined') {
                return extendsEntity(entities[replaced], cb);
            }
            if (typeof onError === 'function') {
                return onError();
            }
        }


        function extendsEntity(entity, cb) {
            if (entity.extends) {
                resolveReference(entity.extends, function (parentEntity) {
                    var merged = $.extend({}, parentEntity, entity);
                    //console.info('extendsEntity', entity.ID, 'parent', entity.extends, 'result', merged);
                    cb(merged);
                });
            } else {
                cb(entity);
            }
        }


        function replaceReferenceInBooleanExpression(expr) {
            console.info("replaceReferenceInBooleanExpression", expr)
            return expr.replace(/\{(\w+)\}/g, function (whole, part) {
                return '"' + formValue[part] + '"';
            });
        }

        function addDynamicReference($field) {
            if ($.inArray($field, dynamicFields) === -1) {
                dynamicFields.push($field);
            }
        }

        function createField(options) {
            var $field = $('<div class="field">').addClass(options.type);
            $field.append($('<label>').text(options.label[language]));
            $field.data('options', options);

            if (isDynamicReference(options.visible)) {
                addDynamicReference($field);
            }

            switch (options.type) {
                case 'Text':
                case 'Number':
                    $field.on('change', 'input', function () {
                        formValue[options.ID] = $(this).val();
                        valueDidChange();
                    });
                    $field.append($('<input>').attr({name: options.ID}));
                    $field.find('input')
                        .attr('type', options.type.toLowerCase())
                        .val(formValue[options.ID]);
                    break;
                case 'SetValues':
                    if (isDynamicReference(options.value)) {
                        addDynamicReference($field);
                    }
                    break;
                case 'RadioButtonGroup':
                case 'CheckboxGroup':
                case 'SelectMultiple':
                    if (isReference(options.choices)) {
                        resolveReference(options.choices, function (list) {
                            $(list.items).each(function (i, item) {
                                $field.append(
                                    $('<label>').append(
                                        $('<input type="radio">')
                                            .attr('name', options.ID)
                                            .attr('value', item.ID)
                                    ).append($('<span>').text(item.label[language]))
                                );
                            });

                        });
                    } else {

                    }

                    if (options.type === 'RadioButtonGroup') {
                        $field.on('change', 'input', function () {
                            formValue[options.ID] = $(this).val();
                            valueDidChange();
                        });
                    } else {
                        $field.find('input').attr('type', 'checkbox');
                        $field.on('change', 'input', function () {
                            var fieldValue = [];
                            $field.find('input').each(function () {
                                if ($(this).is(':checked')) {
                                    fieldValue.push($(this).attr('value'));
                                }
                            });

                            formValue[options.ID] = fieldValue;
                            valueDidChange();
                        });
                    }

                    break;
                case 'Select':
                    var $select = $('<select>').attr({name: options.ID});
                    $select.append('<option>');

                    $select.on('change', function () {
                        formValue[options.ID] = $select.val();
                        valueDidChange();
                    });

                    $field.append($select);
                    if (isReference(options.choices)) {
                        resolveReference(options.choices, function (entity) {
                            $(entity.items).each(function (j, option) {
                                var $option = $('<option>').attr('value', option.ID).text(option.label[language]);
                                $select.append($option);
                            });

                            $select.val(formValue[options.ID] || options.value);
                        }, function () {
                            if (isDynamicReference(options.choices)) {
                                addDynamicReference($field);
                            }
                        });

                    } else {
                        //var options = field.choices.split('\n');
                    }
            }

            return $field;
        }


        function setValue(path, newValue, to) {
            var fragments = String(path).split('.');
            var ref = (typeof to !== 'undefined') ? to : formValue;
            for (var i = 0; i < fragments.length - 1; i++) {
                if (typeof ref[fragments[i]] === 'undefined') {
                    ref[fragments[i]] = {};
                }
                ref = ref[fragments[i]];
            }

            ref[fragments[fragments.length - 1]] = newValue;

        }

        function valueDidChange() {

            $(dynamicFields).each(function (i, $field) {

                var options = $field.data('options');

                if (isDynamicReference(options.visible)) {
                    var expr = '(' + replaceReferenceInBooleanExpression(options.visible) + ')';
                    console.info(expr);
                    var result = math.eval(expr);
                    var visible = (result === true || result === 'true');
                    $field.toggle(visible);

                    if (!visible) {
                        delete formValue[options.ID];
                    }
                }

                if (options.type === 'Select') {
                    var $select = $field.find('select');
                    $select.empty();
                    $select.append('<option>');

                    resolveReference(options.choices, function (entity) {
                        $(entity.items).each(function (j, option) {
                            var $option = $('<option>').attr('value', option.ID).text(option.label[language]);
                            $select.append($option);
                        });

                        $select.val(formValue[options.ID]);
                    });
                }

                if (options.type === 'SetValues') {
                    resolveReference(options.value, function (entity) {
                        $(entity.setters).each(function (j, setter) {
                            setValue(setter.ID, setter.value, product);
                        });
                    });
                }
            });

            $dump.text(JSON.stringify(product, null, 3));

        }

    });
});