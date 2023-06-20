import { CliBaseEnvironment as CliBaseEnvironmentImports } from './imports/cli-base-environment';
import { CliBasePreopens as CliBasePreopensImports } from './imports/cli-base-preopens';
import { CliBaseExit as CliBaseExitImports } from './imports/cli-base-exit';
import { CliBaseStdin as CliBaseStdinImports } from './imports/cli-base-stdin';
import { CliBaseStdout as CliBaseStdoutImports } from './imports/cli-base-stdout';
import { CliBaseStderr as CliBaseStderrImports } from './imports/cli-base-stderr';
import { ClocksWallClock as ClocksWallClockImports } from './imports/clocks-wall-clock';
import { FilesystemFilesystem as FilesystemFilesystemImports } from './imports/filesystem-filesystem';
import { IoStreams as IoStreamsImports } from './imports/io-streams';
import { RandomRandom as RandomRandomImports } from './imports/random-random';
export function generate(component: Uint8Array | ArrayBuffer, options: GenerateOptions): Transpiled;
export function generateTypes(name: string, options: TypeGenerationOptions): Files;

export const $init: Promise<void>;
