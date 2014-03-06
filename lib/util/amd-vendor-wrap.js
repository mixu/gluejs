define(%name%, %deps%, (function (global) {
    return function () {
        var ret, fn;
        return ret || global.%global%;
    };
}(this)));
