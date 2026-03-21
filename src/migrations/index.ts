import * as migration_20260314_183139 from './20260314_183139';
import * as migration_20260315_175410_connect_dots_owner_visibility from './20260315_175410_connect_dots_owner_visibility';
import * as migration_20260321_102501 from './20260321_102501';
import * as migration_20260321_110206 from './20260321_110206';
import * as migration_20260321_113513 from './20260321_113513';
import * as migration_20260321_164759 from './20260321_164759';

export const migrations = [
  {
    up: migration_20260314_183139.up,
    down: migration_20260314_183139.down,
    name: '20260314_183139',
  },
  {
    up: migration_20260315_175410_connect_dots_owner_visibility.up,
    down: migration_20260315_175410_connect_dots_owner_visibility.down,
    name: '20260315_175410_connect_dots_owner_visibility',
  },
  {
    up: migration_20260321_102501.up,
    down: migration_20260321_102501.down,
    name: '20260321_102501',
  },
  {
    up: migration_20260321_110206.up,
    down: migration_20260321_110206.down,
    name: '20260321_110206',
  },
  {
    up: migration_20260321_113513.up,
    down: migration_20260321_113513.down,
    name: '20260321_113513',
  },
  {
    up: migration_20260321_164759.up,
    down: migration_20260321_164759.down,
    name: '20260321_164759'
  },
];
