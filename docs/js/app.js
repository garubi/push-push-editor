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
        pp_import_error:        false,
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
    var sysex = [];
    sysex.push(X_REQ, X_SET);
    sysex = syx_enqueue( sysex );
    toPushPush.sendSysex(PP_MANUF, sysex);
}

function syx_enqueue( sysex ){
    var parameters = Alpine.store('pp').pp_parameters


    sysex.push(Alpine.store('pp').pp_ver_major, Alpine.store('pp').pp_ver_minor, Alpine.store('pp').pp_ver_patch, Alpine.store('pp').pp_model_id, Alpine.store('pp').pp_num_buttons, Alpine.store('pp').pp_keys_sequence_size);
    
    for (let btn = 0; btn < Alpine.store('pp').pp_num_buttons; btn++) {
        for (let key = 0; key < Alpine.store('pp').pp_keys_sequence_size; key++) {
            var nyb1 = ( parameters[btn][key] >>7 ) & 0x7F ;
            var nyb2 = parameters[btn][key]  & 0x7F;
            sysex.push( nyb1, nyb2 );
        }
    }
    return sysex;
}

function syx_is_pushpush( sysex ){
    console.log('PP_MIDI_MANUF_ID_1', PP_MIDI_MANUF_ID_1);
    console.log('data1', sysex[1] );
    if ( sysex[1] != PP_MIDI_MANUF_ID_1 || sysex[2] != PP_MIDI_MANUF_ID_2 || sysex[3] != PP_MIDI_PRODUCT_ID ) return false; // Discard all SysEx that's not for this device
    return true;
}

function syx_is_repl( sysex ){
    if ( sysex[4] != X_REP ) return false; // Discard all messages that are not a reply
    return true;
}

function assignParams( sysex ){
    Alpine.store('pp').pp_got_config            = true;
    Alpine.store('pp').pp_ver_major             = sysex[6];
    Alpine.store('pp').pp_ver_minor             = sysex[7];
    Alpine.store('pp').pp_ver_patch             = sysex[8];
    Alpine.store('pp').pp_model_id              = sysex[9];
    Alpine.store('pp').pp_num_buttons           = sysex[10];
    Alpine.store('pp').pp_keys_sequence_size    = sysex[11];

    var data = Object.values(sysex);
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
}

function parseSysEx( sysex ){
    console.log('sysex: ', sysex );
    if ( !syx_is_pushpush ( sysex.data ) ) return null;
    if ( !syx_is_repl ( sysex.data ) ) return null;

    Alpine.store('pp').pp_loading = false;
    
    var action = sysex.data[5];

    switch ( action ) {
        case X_GET:
            console.info("GET");
            assignParams( sysex.data );

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

async function file_import(){
    let fileHandle;
    try{
        const pickerOpts = {
            types: [
              {
                description: "Push Push editor files",
                accept: {
                  "application/octet-stream": [".pushpush"],
                },
              },
            ],
            excludeAcceptAllOption: true,
            multiple: false,
          };
        [fileHandle] =  await window.showOpenFilePicker( pickerOpts );
        const file =  await fileHandle.getFile();
        const content =  await file.text();
        const sysex = content.split(" ");
        try{

            if( sysex[0] != 240 || sysex[sysex.length -1] != 247 ) throw new TypeError("Wrong data format");
            if ( !syx_is_pushpush ( sysex ) ) throw new TypeError("Data not for Push Push"); 
            if( Alpine.store('pp').device ){
                 if ( Alpine.store('pp').pp_model_id != sysex[9] )  throw new TypeError("Data not for the connected Push Push model"); 
            }
            if ( !syx_is_repl ( sysex ) ) throw new TypeError("Data not for Push Push config");
            if( sysex[5] != X_GET )  throw new TypeError("Data not for Push Push config file");
            if( sysex.length != 2+11+sysex[10]*sysex[11]*2 ) throw new TypeError("Invalid data");

            assignParams( sysex );
        }
        catch (e) {
            console.error(e.message);
            Alpine.store('pp').pp_import_error = e.message;
        }
    }
    catch (e) {
        console.error(e.message);
    }
}

async function file_export() {
    try{
        const options = {
            types: [
                {
                  description: 'Push Push editor files',
                  accept: {
                    'text/plain': ['.pushpush'],
                  },
                },
              ],
        };
        const fileHandle = await window.showSaveFilePicker(options);

        var sysex = [];
        sysex.push( 240, PP_MIDI_MANUF_ID_1, PP_MIDI_MANUF_ID_2, PP_MIDI_PRODUCT_ID, X_REP, X_GET);
        sysex = syx_enqueue( sysex );
        sysex.push(247);
        sysex = sysex.join(' ');

        const writable = await fileHandle.createWritable();
        const optWrite = {
            type: "write",
            data: sysex
        }
        await writable.write( optWrite );
        await writable.close();

    }
    catch (e) {
        console.error(e.message);
    }

  }

  
// fileHandle is an instance of FileSystemFileHandle..
async function writeFile(fileHandle, contents) {
    // Create a FileSystemWritableFileStream to write to.
    const writable = await fileHandle.createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
}