// ============================================
// ADD NEW ITEM (Top Form)
// ============================================
function resetAddForm() {
    if (itemBarcodeInput) itemBarcodeInput.value = '';
    if (itemNameInput) itemNameInput.value = '';
    if (itemUnitSelect) {
        itemUnitSelect.value = '';
        if (itemUnitAutocomplete) itemUnitAutocomplete.refresh();
    }
    if (costPriceInput) costPriceInput.value = '';
    if (salePriceInput) salePriceInput.value = '';
    if (reorderLevelInput) reorderLevelInput.value = '';
    if (initialQuantityInput) initialQuantityInput.value = '';
    
    // Reset Profit Margin Display
    const profitMarginDisplay = document.getElementById('addProfitMargin');
    if (profitMarginDisplay) {
        profitMarginDisplay.textContent = '';
        profitMarginDisplay.className = 'profit-margin-display';
    }

    syncAutoBarcodeField(true);

    // if (itemNameInput) itemNameInput.focus();
}

async function saveNewItem() {
    console.log('saveNewItem() called');
    
    const rawBarcode = itemBarcodeInput ? itemBarcodeInput.value.trim() : '';
    const barcode = isBarcodeManuallyEdited ? rawBarcode : '';
    const name = itemNameInput ? itemNameInput.value.trim() : '';
    let unitId = itemUnitSelect ? itemUnitSelect.value : '';
    const costPrice = costPriceInput ? parseFloat(costPriceInput.value) || 0 : 0;
    const salePrice = salePriceInput ? parseFloat(salePriceInput.value) || 0 : 0;
    const reorderLevel = reorderLevelInput ? parseInt(reorderLevelInput.value) || 0 : 0;
    // Initial Quantity removed to enforce separation of concerns
    const initialQuantity = 0; 

    // Handle New Unit Creation
    if (!unitId && itemUnitAutocomplete) {
        const newUnitName = itemUnitAutocomplete.getInputValue().trim();
        if (newUnitName) {
            // Check if it already exists
            const existingUnit = allUnits.find(u => u.name.toLowerCase() === newUnitName.toLowerCase());
            if (existingUnit) {
                unitId = existingUnit.id;
            } else {
                try {
                    const result = await window.electronAPI.addUnit(newUnitName);
                    if (result.success) {
                        unitId = result.id;
                        await loadUnits(); // Refresh units list
                    } else {
                        Toast.show(t('items.toast.unitAddFailed', 'فشل إضافة الوحدة الجديدة'), 'error');
                        return;
                    }
                } catch (err) {
                    console.error('Error adding new unit:', err);
                    Toast.show(t('items.toast.unitAddError', 'خطأ في إضافة الوحدة'), 'error');
                    return;
                }
            }
        }
    }

    console.log('Form Data:', { barcode, name, unitId, costPrice, salePrice, reorderLevel, initialQuantity });

    // Validation
    if (!name) {
        Toast.show(t('items.toast.nameRequired', 'الرجاء إدخال اسم الصنف'), 'error');
        // if (itemNameInput) itemNameInput.focus();
        return;
    }
    if (!unitId) {
        Toast.show(t('items.toast.unitRequired', 'الرجاء اختيار الوحدة'), 'error');
        // if (itemUnitAutocomplete) itemUnitAutocomplete.input.focus();
        return;
    }

    // Duplicate Check
    const isNameDuplicate = allItems.some(i => i.name.toLowerCase() === name.toLowerCase());
    if (isNameDuplicate) {
        Toast.show(t('items.toast.nameDuplicate', 'اسم الصنف موجود بالفعل'), 'error');
        if (itemNameInput) itemNameInput.select();
        return;
    }

    if (barcode) {
        const isBarcodeDuplicate = allItems.some(i => i.barcode === barcode);
        if (isBarcodeDuplicate) {
            Toast.show(t('items.toast.barcodeDuplicate', 'الباركود مستخدم لصنف آخر'), 'error');
            if (itemBarcodeInput) itemBarcodeInput.select();
            return;
        }
    }

    const itemData = {
        name,
        barcode: barcode || null,
        unit_id: unitId,
        cost_price: costPrice,
        sale_price: salePrice,
        reorder_level: reorderLevel,
        stock_quantity: 0 // Always 0 for new items. Must use Opening Balance or Purchase.
    };

    console.log('Sending to API:', itemData);

    try {
        const result = await window.electronAPI.addItem(itemData);
        console.log('API Result:', result);

        if (result.success) {
            resetAddForm();
            loadItems();
            Toast.show(t('items.toast.addSuccess', 'تم إضافة الصنف بنجاح'), 'success');
        } else {
            console.error('Save failed:', result.error);
            Toast.show(fmt(t('items.toast.errorPrefix', 'حدث خطأ: {error}'), {error: result.error || 'غير معروف'}), 'error');
        }
    } catch (error) {
        console.error('Exception:', error);
        Toast.show(t('items.toast.saveError', 'حدث خطأ أثناء الحفظ'), 'error');
    }
}

// ============================================
// EDIT ITEM (Modal)
// ============================================
function openEditModal(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    if (editItemIdInput) editItemIdInput.value = item.id;
    if (editItemBarcodeInput) editItemBarcodeInput.value = item.barcode || '';
    if (editItemNameInput) editItemNameInput.value = item.name;
    if (editItemUnitSelect) {
        editItemUnitSelect.value = item.unit_id;
        if (editItemUnitAutocomplete) editItemUnitAutocomplete.refresh();
    }
    if (editCostPriceInput) editCostPriceInput.value = item.cost_price || 0;
    if (editSalePriceInput) editSalePriceInput.value = item.sale_price;
    if (editReorderLevelInput) editReorderLevelInput.value = item.reorder_level || '';
    if (editStockQuantityInput) editStockQuantityInput.value = item.stock_quantity || 0;

    // Calculate initial margin
    if (editCostPriceInput && editSalePriceInput) {
        calculateProfitMargin(editCostPriceInput, editSalePriceInput, 'editProfitMargin');
    }

    if (editModal) editModal.classList.add('show');
}

function closeEditModal() {
    if (editModal) editModal.classList.remove('show');
}

async function saveEditedItem() {
    const id = editItemIdInput ? editItemIdInput.value : null;
    const barcode = editItemBarcodeInput ? editItemBarcodeInput.value.trim() : '';
    const name = editItemNameInput ? editItemNameInput.value.trim() : '';
    let unitId = editItemUnitSelect ? editItemUnitSelect.value : '';
    const costPrice = editCostPriceInput ? parseFloat(editCostPriceInput.value) || 0 : 0;
    const salePrice = editSalePriceInput ? parseFloat(editSalePriceInput.value) || 0 : 0;
    const reorderLevel = editReorderLevelInput ? parseInt(editReorderLevelInput.value) || 0 : 0;
    // Stock Quantity is ignored in update to prevent manual override without transaction
    // const stockQuantity = editStockQuantityInput ? parseFloat(editStockQuantityInput.value) || 0 : 0; 

    // Handle New Unit Creation (Edit Mode) - Always validate input text against units
    if (editItemUnitAutocomplete) {
        const inputText = editItemUnitAutocomplete.getInputValue().trim();
        if (inputText) {
            // Find unit that matches the input text exactly (case-insensitive)
            const matchingUnit = allUnits.find(u => u.name.toLowerCase() === inputText.toLowerCase());
            if (matchingUnit) {
                // Use the matching unit
                unitId = matchingUnit.id;
            } else {
                // Unit doesn't exist - ask user to add it
                const confirmAdd = typeof window.showConfirmDialog === 'function'
                    ? await window.showConfirmDialog(fmt(t('items.toast.unitConfirmNew', `الوحدة "{name}" غير موجودة في قائمة الوحدات.\n\nهل تريد إضافتها الآن للوحدات وللصنف؟`), {name: inputText}))
                    : false;
                if (!confirmAdd) {
                    Toast.show(t('items.toast.unitSelectionRequired', 'يجب اختيار وحدة موجودة'), 'warning');
                    // editItemUnitAutocomplete.input.focus();
                    return;
                }
                
                try {
                    const result = await window.electronAPI.addUnit(inputText);
                    if (result.success) {
                        unitId = result.id;
                        await loadUnits();
                        Toast.show(t('items.toast.unitAddSuccess', 'تم إضافة الوحدة بنجاح'), 'success');
                    } else {
                        Toast.show(t('items.toast.unitAddFailed', 'فشل إضافة الوحدة الجديدة'), 'error');
                        return;
                    }
                } catch (err) {
                    console.error('Error adding new unit:', err);
                    Toast.show(t('items.toast.unitAddError', 'خطأ في إضافة الوحدة'), 'error');
                    return;
                }
            }
        } else {
            unitId = ''; // No input text means no unit
        }
    }

    if (!name || !unitId) {
        Toast.show(t('items.toast.dataRequired', 'الرجاء إكمال البيانات المطلوبة'), 'error');
        return;
    }

    // Duplicate Check
    const isNameDuplicate = allItems.some(i => i.name.toLowerCase() === name.toLowerCase() && i.id != id);
    if (isNameDuplicate) {
        Toast.show(t('items.toast.nameDuplicate', 'اسم الصنف موجود بالفعل'), 'error');
        return;
    }

    if (barcode) {
        const isBarcodeDuplicate = allItems.some(i => i.barcode === barcode && i.id != id);
        if (isBarcodeDuplicate) {
            Toast.show(t('items.toast.barcodeDuplicate', 'الباركود مستخدم لصنف آخر'), 'error');
            return;
        }
    }

    const itemData = {
        id,
        name,
        barcode: barcode || null,
        unit_id: unitId,
        cost_price: costPrice,
        sale_price: salePrice,
        reorder_level: reorderLevel
        // stock_quantity removed
    };

    try {
        const result = await window.electronAPI.updateItem(itemData);

        if (result.success) {
            closeEditModal();
            loadItems();
            Toast.show(t('items.toast.updateSuccess', 'تم تعديل الصنف بنجاح'), 'success');
        } else {
            Toast.show(fmt(t('items.toast.errorPrefix', 'حدث خطأ: {error}'), {error: result.error || 'غير معروف'}), 'error');
        }
    } catch (error) {
        console.error('Exception:', error);
        Toast.show(t('items.toast.updateError', 'حدث خطأ أثناء التعديل'), 'error');
    }
}

// ============================================
// DELETE ITEM
// ============================================
function showDeleteModal(id) {
    itemToDeleteId = id;
    if (deleteModal) deleteModal.classList.add('show');
}

function hideDeleteModal() {
    itemToDeleteId = null;
    if (deleteModal) deleteModal.classList.remove('show');
}

async function confirmDelete() {
    if (!itemToDeleteId) return;
    
    try {
        const result = await window.electronAPI.deleteItem(itemToDeleteId);
        if (result.success) {
            hideDeleteModal();
            await loadItems();
            Toast.show(t('items.toast.deleteSuccess', 'تم حذف الصنف بنجاح'), 'success');
        } else {
            hideDeleteModal();
            Toast.show(result.error || t('items.toast.deleteError', 'حدث خطأ أثناء الحذف'), 'error');
        }
    } catch (error) {
        console.error('Exception:', error);
        hideDeleteModal();
        Toast.show(t('items.toast.deleteError', 'حدث خطأ أثناء الحذف'), 'error');
    }
}

