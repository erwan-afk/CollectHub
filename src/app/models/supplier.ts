export interface Supplier {
  id: number;
  name: string;
  siret: string | null;
  vatNumber: string | null;
  iban: string | null;
  address: string | null;
  createdAt: string;
}

export type SupplierInput = Omit<Supplier, 'id' | 'createdAt'>;
