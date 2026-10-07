// Small hand-off store for values passed between routes (router params that are not part of the path).
import { reactive } from 'vue';

export const nav = reactive({
  previousGameUserName: undefined,
  joinError: undefined, // { status, gameId }
});

export function takePreviousGameUserName() {
  const v = nav.previousGameUserName;
  nav.previousGameUserName = undefined;
  return v;
}

export function takeJoinError() {
  const v = nav.joinError;
  nav.joinError = undefined;
  return v;
}
