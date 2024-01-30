var editor_version = '1.1.0';

var PP_MIDI_MANUF_ID_1			=	0x37;
var PP_MIDI_MANUF_ID_2			=	0x72;
var PP_MIDI_PRODUCT_ID			=	0x10;

var PP_MANUF = [PP_MIDI_MANUF_ID_1, PP_MIDI_MANUF_ID_2, PP_MIDI_PRODUCT_ID];

var X_REQ = 0x00; // Request
var X_REP = 0x01; // Replay

var X_GET = 0x00;
var X_SET = 0x01;
var X_ERROR = 0x7F; // Something went wrong

var X_OK = 0x01;
var X_FAILED = 0x7F;

document.addEventListener('alpine:init', () => {
    Alpine.store('pp', {
        editor_version:         editor_version,
        devices:                '',
        no_devices:             false,
        device:                 '',
        pp_got_config:          false,
        pp_ver_major:           '',         
        pp_ver_minor:           '',         
        pp_ver_patch:           '',         
        pp_model_id:            '',          
        pp_num_buttons:         '',       
        pp_keys_sequence_size:  '',
        pp_loading:             false,
        pp_stored:              false,
        pp_errors:              false,
    });

        


    // https://webmidijs.org/docs/getting-started/basics
    // Enable WebMidi.js and trigger the onEnabled() function when ready.
    WebMidi
    .enable({sysex: true})
    .then(onEnabled)
    .catch(err => alert(err));


                               
})
function appInit(){
}

function appData(){
return { };
}

function onEnabled() {

    if (WebMidi.inputs.length < 1) {
        console.log("No device detected");
        Alpine.store('pp').pp_no_devices    = true;
    } else {
        console.log("Devices detected: ", WebMidi.inputs );
        var devices = [];
        WebMidi.inputs.forEach((device, index) => {
            console.log("Device: ", device.name);
            devices[index] = {id: device.id, name: device.name}
        });
        Alpine.store('pp').devices    = devices;
    }

}

function connect(  ){
    device_name = Alpine.store('pp').device;
    Alpine.store('pp').pp_loading = true;
    console.log('Connect to: ', device_name);
    toPushPush = WebMidi.getOutputByName(device_name) ;

    toPushPush.sendSysex(PP_MANUF, [X_REQ, X_GET]);

    fromPushPush = WebMidi.getInputByName(device_name)  

    fromPushPush.addListener("sysex", parseSysEx);
}

function store(){
    Alpine.store('pp').pp_loading = true;
    var parameters = Alpine.store('pp').pp_parameters

    var sysex = [];
    sysex.push(X_REQ, X_SET);
    sysex.push(Alpine.store('pp').pp_ver_major, Alpine.store('pp').pp_ver_minor, Alpine.store('pp').pp_ver_patch, Alpine.store('pp').pp_model_id, Alpine.store('pp').pp_num_buttons, Alpine.store('pp').pp_keys_sequence_size);
    
    for (let btn = 0; btn < Alpine.store('pp').pp_num_buttons; btn++) {
        for (let key = 0; key < Alpine.store('pp').pp_keys_sequence_size; key++) {
            var nyb1 = ( parameters[btn][key] >>7 ) & 0x7F ;
            var nyb2 = parameters[btn][key]  & 0x7F;
            sysex.push( nyb1, nyb2 );
        }
    }

    toPushPush.sendSysex(PP_MANUF, sysex);
}

function parseSysEx( sysex ){
    console.log('sysex: ', sysex );
    if ( sysex.data[1] != PP_MIDI_MANUF_ID_1 || sysex.data[2] != PP_MIDI_MANUF_ID_2 || sysex.data[3] != PP_MIDI_PRODUCT_ID ) return null; // Discard all SysEx that's not for this device
    if ( sysex.data[4] != X_REP ) return null; // Discard all messages that are not a reply

    Alpine.store('pp').pp_loading = false;
    
    var action = sysex.data[5];

    switch ( action ) {
        case X_GET:
            console.info("GET");
            Alpine.store('pp').pp_got_config            = true;
            Alpine.store('pp').pp_ver_major             = sysex.data[6];
            Alpine.store('pp').pp_ver_minor             = sysex.data[7];
            Alpine.store('pp').pp_ver_patch             = sysex.data[8];
            Alpine.store('pp').pp_model_id              = sysex.data[9];
            Alpine.store('pp').pp_num_buttons           = sysex.data[10];
            Alpine.store('pp').pp_keys_sequence_size    = sysex.data[11];

            var data = Object.values(sysex.data);
            data = data.slice( 12, -1 );
            var parameters = [];
            var index = 0;
            for (let btn = 0; btn < Alpine.store('pp').pp_num_buttons; btn++) {
                // console.log('index: ', index);
                parameters[btn] = [];
                // console.log('btn: ', btn);
                for (let key = 0; key < Alpine.store('pp').pp_keys_sequence_size; key++) {
                    // console.log('key:', key);
                    nymb1 = data[index];
                    nymb2 = data[index+1];
                    // console.log('nym1', nymb1);
                    // console.log('nym2', nymb2);
                    
                    var res = (data[index] << 7) | data[index+1] ;  // combine the 7 bit chunks to 14 bits in the int
                    res = res << 2 >> 2 ;  // sign-extend as 16 bit
                    // console.log('res: ', res);
                    parameters[btn][key] = res;
                    index = index + 2;
                }
            }
            console.log('parameters', parameters);
            Alpine.store('pp').pp_parameters = parameters;
        break;

        case X_SET:
            console.info("SET");
            var pp_set_response     = sysex.data[6];

            Alpine.store('pp').pp_stored = pp_set_response;
            
            console.log('pp_set_response', pp_set_response);
        break;

        case X_ERROR:
        default:
            Alpine.store('pp').pp_errors = true;
            console.error("Action invalid: ", action );
        break;
    }
}