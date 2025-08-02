const esc = {
    error: "\x1b[31m",
    info: "\x1b[36m",
    success: "\x1b[32m",
    warning: "\x1b[33m",
    reset: "\x1b[0m"
}

let logLevel: number = 4;

function _timeStr (): string {
    let date = new Date();
    let day = date.getDate().toString();
    let month = (date.getMonth()+1).toString();
    let year = date.getFullYear().toString();
    let hours = date.getHours().toString();
    let minutes = date.getMinutes().toString();
    let seconds = date.getSeconds().toString();
    let millis = date.getMilliseconds().toString();
    return (day.length<2? "0" + day: day) + "/" + 
        (month.length<2? "0" + month: month) + "/" +
        year + " " +
        (hours.length<2? "0" + hours: hours) + ":" +
        (minutes.length<2? "0" + minutes: minutes) + ":" +
        (seconds.length<2? "0" + seconds: seconds) + " " +
        millis;
}

function _log (cl: string, msg: string) {
    console.log(cl + "[" + _timeStr() + "] " + msg + esc.reset);
}

function error (msg: string, level: number) {
    if (logLevel >= level) {
        _log(esc.error, msg);
    }
}

function info (msg: string, level: number) {
    if (logLevel >= level) {
        _log(esc.info, msg);
    }
}

function success (msg: string, level: number) {
    if (logLevel >= level) {
        _log(esc.success, msg);
    }
}

function warning (msg: string, level: number) {
    if (logLevel >= level) {
        _log(esc.warning, msg);
    }
}

function setLogLevel (level: number) {
    logLevel = level;
}

function getLogLevel (): number {
    return logLevel;
}

export default {
    error: error,
    info: info,
    success: success,
    warning: warning,
    setLogLevel: setLogLevel,
    getLogLevel: getLogLevel
};
