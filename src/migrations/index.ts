import * as migration_20260314_183139 from './20260314_183139';
import * as migration_20260315_175410_connect_dots_owner_visibility from './20260315_175410_connect_dots_owner_visibility';
import * as migration_20260321_102501 from './20260321_102501';
import * as migration_20260321_110206 from './20260321_110206';
import * as migration_20260321_113513 from './20260321_113513';
import * as migration_20260321_164759 from './20260321_164759';
import * as migration_20260426_090219 from './20260426_090219';
import * as migration_20260426_094457_homepage_feature_image_ratio from './20260426_094457_homepage_feature_image_ratio';
import * as migration_20260426_095216_homepage_section_toggles from './20260426_095216_homepage_section_toggles';
import * as migration_20260426_104206_media_owner_access from './20260426_104206_media_owner_access';
import * as migration_20261001_135529 from './20261001_135529';

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
    name: '20260321_164759',
  },
  {
    up: migration_20260426_090219.up,
    down: migration_20260426_090219.down,
    name: '20260426_090219',
  },
  {
    up: migration_20260426_094457_homepage_feature_image_ratio.up,
    down: migration_20260426_094457_homepage_feature_image_ratio.down,
    name: '20260426_094457_homepage_feature_image_ratio',
  },
  {
    up: migration_20260426_095216_homepage_section_toggles.up,
    down: migration_20260426_095216_homepage_section_toggles.down,
    name: '20260426_095216_homepage_section_toggles',
  },
  {
    up: migration_20260426_104206_media_owner_access.up,
    down: migration_20260426_104206_media_owner_access.down,
    name: '20260426_104206_media_owner_access',
  },
  {
    up: migration_20261001_135529.up,
    down: migration_20261001_135529.down,
    name: '20261001_135529'
  },
];
