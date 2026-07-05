import { useEffect, useState } from 'react';
import { Autocomplete } from '@mantine/core';
import { api } from '../api/client';

const FALLBACK_BRANDS = ['Regasco', 'Seagas', 'Pryce'];

// Searchable dropdown with free-text entry for LPG brands.
// Existing brands are suggested; typing a brand name that doesn't exist yet
// is allowed, and the backend registers it automatically (case-insensitive,
// trimmed) the next time it's used to create/update a product or sale.
export default function BrandAutocomplete({
  value,
  onChange,
  label = 'Brand',
  required = false,
  placeholder = 'Select or type a brand',
  id,
}) {
  const [brands, setBrands] = useState(FALLBACK_BRANDS);

  useEffect(() => {
    api
      .getBrands()
      .then((res) => setBrands(res.data?.length ? res.data : FALLBACK_BRANDS))
      .catch(() => setBrands(FALLBACK_BRANDS));
  }, []);

  return (
    <Autocomplete
      id={id}
      label={label}
      placeholder={placeholder}
      data={brands}
      value={value}
      onChange={onChange}
      limit={10}
      withAsterisk={required}
      classNames={{
        label: 'text-[11px] font-bold uppercase text-slate-500 mb-1',
      }}
    />
  );
}
