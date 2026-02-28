package org.yamcs.labjack;

import com.sun.jna.ptr.DoubleByReference;
import libs.LJM;
import org.yamcs.logging.Log;

/**
 * @author Jake
 * Utility class for LabJack. Contains a bunch of static methods that provide abstraction
 * on reading/writing from/to the LabJack.
 */
public class LabJackUtil {
    //range of analog pins to poll on the LabJack (T7)
    public static final int ANALOG_PIN_START = 79;
    public static final int ANALOG_PIN_END = 123;
    public static final int NUM_ANALOG_PINS = ANALOG_PIN_END - ANALOG_PIN_START + 1; // 45 pins

    //total number of digital pins on the LabJack (T7)
    public static final int NUM_DIGITAL_PINS = 23;
    private static final Log log = new Log(LabJackUtil.class);


    /**
     * Reads a single digital pin on the LabJack.
     * WARNING: using this method to read a digital pin that is currently in write mode will put the pin in read mode.
     * Ex: if you previously wrote LOW to DIO1, t v vcv HIGH (if no load is attached).
     * If you want to avoid this side effect, use {@link #readDigitalPins(int)}.
     *
     * @param deviceHandle device handle of the connected LabJack
     * @param pinNum pinNum of the digital pin (0-22)
     * @return 0 if reading is low, 1 if reading is high and 2 if unknown reading
     */
    public static int readDigitalPin(int deviceHandle, int pinNum){
        DoubleByReference valueRef = new DoubleByReference(0);
        int base_address = 2000;
        int type = LJM.Constants.UINT16;
        try{
            LJM.eReadAddress(deviceHandle, base_address + pinNum, type, valueRef);
        } catch(Exception e){
            log.error("Could not read from digital pin: " + (base_address + pinNum * 2));
            return 2;
        }
        return valueRef.getValue() >= 0.5 ? 1 : 0;
    }

    /**
     * Reads the DIO_STATE on the LabJack. The DIO_STATE register contains the state of every digital pin
     * on the LabJack. It is preferred to read this register over reading the individual pins since reading
     * individual pins will cause their directionality to be set to input.
     * The DIO_STATE contains a 32-bit unsigned integer for which the most significant 9 bits are garbage
     * (32-9=23! # of digital pins).
     *
     * @param deviceHandle device handle of the connected LabJack
     * @return an array of 3 bytes for which the last element's least significant bit is garbage
     */
    public static byte[] readDigitalPins(int deviceHandle){
        DoubleByReference readingRef = new DoubleByReference();

        try{
            LJM.eReadName(deviceHandle, "DIO_STATE", readingRef);
            int temp = Integer.reverse(((int) readingRef.getValue()) << 9) << 9;


            byte[] result = new byte[3];

            result[0] = (byte) (temp >> 24);  // Most significant byte
            result[1] = (byte) (temp >> 16);
            result[2] = (byte) (temp >> 8);
            return result;

        } catch(Exception e){
            log.error("Could not read from DIO_STATE register");
            return null;
        }
    }

    /**
     * Reads a single analog pin
     * @param deviceHandle device handle of the connected LabJack
     * @param pinNum pinNum of pin to read (MUST BE BETWEEN 0-13 inclusive)
     * @return value read from analog pin, Double.NaN if error occurred
     */
    public static double readAnalogPin(int deviceHandle, int pinNum){
        DoubleByReference valueRef = new DoubleByReference(0);
        int base_address = 0;
        try{
            LJM.eReadAddress(deviceHandle, base_address + pinNum*2, LJM.Constants.FLOAT32, valueRef);
        } catch(Exception e){
            log.error("Could not read from analog pin: " + (base_address + pinNum * 2));
            return Double.NaN;
        }
        return valueRef.getValue();
    }

    /**
     * Sets the given DAC pin to the given voltage.
     * @param deviceHandle device handle of the connected LabJack
     * @param pinNum pin number of DAC pin to write to (between 0-1 inclusive)
     * @param value voltage to set DAC pin to (between 0-5 inclusive)
     */
    public static void setDACPin(int deviceHandle, int pinNum, double value){

        int base_address = 1000;
        int type = LJM.Constants.FLOAT32;

        LJM.eWriteAddress(deviceHandle, base_address + pinNum*2, type, value);
    }

    /**
     * Sets the given digital pin to the given state.
     * @param deviceHandle device handle of the connected LabJack
     * @param pinNum pin number of digital pin to write to (between 0-22 inclusive)
     * @param digitalState digital pin state to set pin to (HIGH = 1, LOW = 0)
     */
    public static void setDigitalPin(int deviceHandle, int pinNum, int digitalState){
        int base_address = 2000;
        int type = LJM.Constants.UINT16;
        if(digitalState != 0 && digitalState != 1){
            log.error("Writing invalid state to digital pin (not HIGH or LOW)");
            return;
        }
        if(pinNum < 0 || pinNum > 22){
            log.error("Writing to digital pin that does not exist (not 0-22)");
            return;
        }

        LJM.eWriteAddress(deviceHandle, base_address + pinNum, type, digitalState);

    }
}
