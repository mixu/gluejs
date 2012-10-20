function require(p, context) {
  // normalize function
  // Use index presence to iterate arrays of truthy items
  for (var normalized = [], parts = p.split('/'), mod, temp, i = 0; temp = parts[i++]; ) {
    if ('..' == temp) normalized.pop();
    else if ('.' != temp) normalized.push(temp);
  }
  // inlined resolve
  normalized = normalized.join('/');
  i = require; // note: do not assign to i after this. It is reused in mod.call, so we avoid writing "require" twice
  temp = i["m"][context || 0];
  mod = temp[normalized + '.js']
      || temp[normalized +'/index.js']
      || temp[normalized];
  if(temp = mod.c) {
    mod = i["m"][context = temp][p = mod.m];
    // Because packaging is done via a library
    // we can safely assume that mod.context > 0 and
    // mod.main is a absolute path that does
    // not need to be normalized
  }
  //if (!mod) throw Error('Cannot require("' + p + '")');

  return mod.exports || (mod.call(temp = mod.exports = {}, mod, temp, function(name) {
        return i(("." != name.charAt(0) ? name : p + "/../" + name), context);
    })), temp;
};
