import { useState } from 'react';
import { Check, X, Plus, Trash2 } from 'lucide-react';
import type { AdminProductVariantDto } from '@/server/admin/products/get-product-variants';
import type { VariantFieldsInput } from '@/server/admin/products/product-variant-schema';
import {
  MAX_OPTION_KEYS,
  OPTION_KEY_MAX_LENGTH,
  OPTION_VALUE_MAX_LENGTH,
  VARIANT_NAME_MAX_LENGTH,
  VARIANT_SKU_MAX_LENGTH,
  VARIANT_BARCODE_MAX_LENGTH,
} from '@/server/admin/products/product-variant-schema';
import { FormField, formInputClass } from './variant-form-field';

/**
 * Variant add/edit form — Step 2.4.5.
 *
 * Shared by the "Add variant" flow and per-row inline editing. Captures the
 * full variant field set including dynamic option key/value pairs. The server
 * remains the validation authority; this form only does light UX checks.
 */

interface VariantFormProps {
  mode: 'create' | 'update';
  initial?: AdminProductVariantDto;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (data: VariantFieldsInput) => void;
}

interface OptionPair {
  key: string;
  value: string;
}

interface FormState {
  name: string;
  sku: string;
  optionPairs: OptionPair[];
  priceMinor: string;
  currency: string;
  stock: string;
  barcode: string;
  isDefault: boolean;
}

function initialToForm(initial?: AdminProductVariantDto): FormState {
  if (!initial) {
    return {
      name: '',
      sku: '',
      optionPairs: [{ key: '', value: '' }],
      priceMinor: '',
      currency: '',
      stock: '0',
      barcode: '',
      isDefault: false,
    };
  }
  return {
    name: initial.name,
    sku: initial.sku,
    optionPairs: Object.entries(initial.optionValues).map(([key, value]) => ({ key, value })),
    priceMinor: initial.priceMinor ?? '',
    currency: initial.currency ?? '',
    stock: String(initial.stock),
    barcode: initial.barcode ?? '',
    isDefault: initial.isDefault,
  };
}

export function VariantForm({ mode, initial, busy, onCancel, onSubmit }: VariantFormProps) {
  const [form, setForm] = useState<FormState>(() => initialToForm(initial));
  const [formError, setFormError] = useState<string | null>(null);

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setFormError(null);
  }

  function updatePair(index: number, patch: Partial<OptionPair>) {
    setForm((prev) => ({
      ...prev,
      optionPairs: prev.optionPairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)),
    }));
  }

  function addPair() {
    setForm((prev) =>
      prev.optionPairs.length >= MAX_OPTION_KEYS
        ? prev
        : { ...prev, optionPairs: [...prev.optionPairs, { key: '', value: '' }] },
    );
  }

  function removePair(index: number) {
    setForm((prev) => ({
      ...prev,
      optionPairs: prev.optionPairs.filter((_, i) => i !== index),
    }));
  }

  function handleSubmit() {
    if (form.name.trim() === '' || form.sku.trim() === '') {
      setFormError('Name and SKU are required.');
      return;
    }
    const incomplete = form.optionPairs.some(
      (pair) => (pair.key.trim() === '') !== (pair.value.trim() === ''),
    );
    if (incomplete) {
      setFormError('Each option row needs both a name and a value, or should be removed.');
      return;
    }

    const optionValues: Record<string, string> = {};
    for (const pair of form.optionPairs) {
      const key = pair.key.trim();
      const value = pair.value.trim();
      if (key !== '' && value !== '') optionValues[key] = value;
    }

    onSubmit({
      name: form.name,
      sku: form.sku,
      optionValues,
      priceMinor: form.priceMinor.trim() === '' ? null : form.priceMinor.trim(),
      currency: form.currency === '' ? null : (form.currency as 'BDT' | 'USD'),
      stock: Number(form.stock),
      barcode: form.barcode.trim() === '' ? null : form.barcode.trim(),
      isDefault: form.isDefault,
    });
  }

  const readOnly = busy;

  return (
    <div className="bg-bg-elevated space-y-4 rounded-lg border border-cyan-400/30 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required>
          <input
            type="text"
            value={form.name}
            readOnly={readOnly}
            onChange={(e) => update({ name: e.target.value })}
            className={formInputClass(readOnly)}
            maxLength={VARIANT_NAME_MAX_LENGTH}
          />
        </FormField>
        <FormField label="SKU" required help="Stored uppercase. Must be globally unique.">
          <input
            type="text"
            value={form.sku}
            readOnly={readOnly}
            onChange={(e) => update({ sku: e.target.value })}
            className={formInputClass(readOnly)}
            maxLength={VARIANT_SKU_MAX_LENGTH}
          />
        </FormField>
      </div>

      <FormField
        label="Option values"
        help="Option groups are derived from these pairs, e.g. Color = Black."
      >
        <div className="space-y-2">
          {form.optionPairs.map((pair, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Option (e.g. Color)"
                value={pair.key}
                readOnly={readOnly}
                onChange={(e) => updatePair(index, { key: e.target.value })}
                className={formInputClass(readOnly)}
                maxLength={OPTION_KEY_MAX_LENGTH}
              />
              <input
                type="text"
                placeholder="Value (e.g. Black)"
                value={pair.value}
                readOnly={readOnly}
                onChange={(e) => updatePair(index, { value: e.target.value })}
                className={formInputClass(readOnly)}
                maxLength={OPTION_VALUE_MAX_LENGTH}
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removePair(index)}
                  aria-label="Remove option row"
                  className="text-steel-500 hover:text-danger shrink-0 rounded p-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              type="button"
              onClick={addPair}
              disabled={form.optionPairs.length >= MAX_OPTION_KEYS}
              className="inline-flex items-center gap-1.5 rounded text-sm text-cyan-300 hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add option
            </button>
          )}
        </div>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Price (minor units)" help="Blank = inherit product price.">
          <input
            type="text"
            inputMode="numeric"
            value={form.priceMinor}
            readOnly={readOnly}
            onChange={(e) => update({ priceMinor: e.target.value.replace(/[^0-9]/g, '') })}
            className={formInputClass(readOnly)}
          />
        </FormField>
        <FormField label="Currency" help="Blank = inherit product currency.">
          <select
            value={form.currency}
            disabled={readOnly}
            onChange={(e) => update({ currency: e.target.value })}
            className={formInputClass(readOnly)}
          >
            <option value="">Inherit</option>
            <option value="BDT">BDT</option>
            <option value="USD">USD</option>
          </select>
        </FormField>
        <FormField
          label="Stock"
          help="Stock is managed only in Inventory (Step 2.4.6A1). Variants start at 0."
        >
          <input
            type="number"
            min={0}
            step={1}
            value={form.stock}
            disabled
            readOnly
            onChange={(e) => update({ stock: e.target.value.replace(/[^0-9]/g, '') })}
            className={formInputClass(true)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Barcode" help="EAN/UPC, optional.">
          <input
            type="text"
            value={form.barcode}
            readOnly={readOnly}
            onChange={(e) => update({ barcode: e.target.value })}
            className={formInputClass(readOnly)}
            maxLength={VARIANT_BARCODE_MAX_LENGTH}
          />
        </FormField>
        <FormField label="Default variant" help="Used when no variant is selected.">
          <label className="text-steel-200 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              disabled={readOnly}
              onChange={(e) => update({ isDefault: e.target.checked })}
              className="border-steel-700 bg-bg-elevated h-4 w-4 rounded accent-cyan-400"
            />
            Set as the default variant
          </label>
        </FormField>
      </div>

      {formError && <p className="text-danger text-sm">{formError}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={readOnly}
          className="border-steel-700 text-steel-300 hover:text-steel-100 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden /> Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden />
          {mode === 'create' ? 'Create variant' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
