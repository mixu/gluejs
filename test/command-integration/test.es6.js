import { inspect } from "util";

function log(foo) {
  console.log(inspect(foo));
}

export log;
