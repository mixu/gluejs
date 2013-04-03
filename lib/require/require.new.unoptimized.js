function require(p, context) {
  /* normalize function: Use index presence to iterate arrays of truthy items */
  for (var normalized = [], parts = p.split('/'), mod, temp, i = 0; temp = parts[i++]; ) {
    if ('..' == temp) normalized.pop();
    else if ('.' != temp) normalized.push(temp);
  }
  /* inlined resolve */
  normalized = normalized.join('/');
  i = require; /* note: do not assign to i after this. It is reused in mod.call, so we avoid writing "require" twice */
  temp = i["m"][context || 0];
  mod = temp[normalized + '.js']
      || temp[normalized +'/index.js']
      || temp[normalized];
  parts = 'Cannot require("' + p + '")';
  if (!mod) throw Error(parts+);
  if(temp = mod.c) {
    mod = i["m"][context = temp][p = mod.m];
    /* Because packaging is done via a library
     we can safely assume that mod.context > 0 and
     mod.main is a absolute path that does
     not need to be normalized */
  }
  /* console.log('Load ['+ (context || 0) +']["' +  p + '"], result', !!mod, !!mod.exports);*/
  if (!mod) throw Error(parts);

  if(!mod.exports){
    /* It would be tempting to replace the string .exports here.
       But the problem is that since modules can replace exports with a new object in addition to
       just augmenting it, we always need to return the object.
    */
    mod(mod, mod.exports = {}, function(name) {
        return i(("." != name.charAt(0) ? name : p + "/../" + name), context);
    });
  }
  return mod.exports;
};
