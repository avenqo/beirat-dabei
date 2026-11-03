import * as migration_20261103_045919_initial from './20261103_045919_initial';
import * as migration_20261103_050601_ergaenzungen from './20261103_050601_ergaenzungen';

export const migrations = [
  {
    up: migration_20261103_045919_initial.up,
    down: migration_20261103_045919_initial.down,
    name: '20261103_045919_initial',
  },
  {
    up: migration_20261103_050601_ergaenzungen.up,
    down: migration_20261103_050601_ergaenzungen.down,
    name: '20261103_050601_ergaenzungen'
  },
];
