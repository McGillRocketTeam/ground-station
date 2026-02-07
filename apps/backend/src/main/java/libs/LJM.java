/**
 * 
 */
package libs;

import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Platform;
import com.sun.jna.Pointer;
import com.sun.jna.ptr.DoubleByReference;
import com.sun.jna.ptr.IntByReference;
import com.sun.jna.ptr.LongByReference;
import com.sun.jna.ptr.PointerByReference;
import com.sun.jna.win32.StdCallLibrary;

/**
 * LJM is the wrapper class to the LJM library's functions and
 * constants. Refer to the LabJackM.h header file or online User's
 * Guide for functions and constants documentation:<br>
 * <br>
 * &nbsp;&nbsp;&nbsp;&nbsp;<a href="https://labjack.com/support/software/api/ljm">https://labjack.com/support/software/api/ljm</a><br>
 * <p>LJM library C to Java differences:
 * <ul>
 * <li>C functions are implemented in the LJM class as static
 * methods. The function name's "LJM_" prefix have been removed and
 * the first letter have been changed to lowercase.
 * <li>C constants can be found in the LJM.Constants class. The
 * constant name's "LJM_" prefix have been removed.
 * <li>C error code constants can be found in the LJM.Errors enum.
 * The constant name's "LJME_" prefix have been removed.
 * <li>C function parameter names have had the first letter changed
 * to lowercase.
 * <li>If the wrapper method detects an error it will throw a
 * LJMException exception, setting the error and errorAddress values,
 * and exception message.
 * <li>C parameters that are pass by reference are implemented in
 * Java as arrays, or JNA classes IntByReference, DoubleByReference,
 * or LongByReference for single value references.
 * <li>C string parameters are implemented in Java as a String and
 * pass by reference strings are a JNA class Pointer.<br>
 * <li>When using a JNA Pointer for C strings, the JNA Memory class
 * needs to be used to construct the pointer and allocate memory.
 * For example:<br>
 * <br>
 * &nbsp;&nbsp;&nbsp;&nbsp;Pointer stringPtr = new Memory(100);&nbsp;&nbsp;//Allocates 100 bytes of memory which is a 100 character C string.
 * </ul>
 * 
 * <p>Version History
 * <ul>
 * <li>1.23<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Updated functions, constants and error
 * codes to LJM v1.23.
 * <li>1.17<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Updated functions, constants and error
 * codes to LJM v1.17.
 * <li>1.16<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Updated functions, constants and error
 * codes to LJM v1.16.<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Matching version with the LJM version.
 * <li>0.93<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Updated functions, constants and error
 * codes to LJM v1.8.
 * <li>0.92<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Updated functions, constants and error
 * codes to LJM v1.2.
 * <li>0.91<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Added Linux and Mac OS X support.
 * <li>0.90<br>
 * &nbsp;&nbsp;&nbsp;&nbsp;- Initial release tested with LJM v1.1.1.
 * Windows support only.
 * </ul>
 * @author LabJack Corporation {@literal <}support@labjack.com{@literal >}
 * @version 1.23
 */
public class LJM {
	public interface LabJackM extends Library {
		LabJackM INSTANCE = (LabJackM)Native.load("LabJackM",
				(Class)(Platform.isWindows() ? WindowsLabJackM.class : LabJackM.class));

		int LJM_ListAll(int DeviceType, int ConnectionType,
				IntByReference NumFound, int[] aDeviceTypes,
				int[] aConnectionTypes, int[] aSerialNumbers,
				int[] aIPAddresses);

		int LJM_ListAllS(final String DeviceType, final String ConnectionType, 
				IntByReference NumFound, int[] aDeviceTypes,
				int[] aConnectionTypes, int[] aSerialNumbers,
				int[] aIPAddresses);

		int LJM_ListAllExtended(int DeviceType, int ConnectionType,
				int NumAddresses, final int[] aAddresses, final int[] aNumRegs,
				int MaxNumFound, IntByReference NumFound, int[] aDeviceTypes,
				int[] aConnectionTypes, int[] aSerialNumbers,
				int[] aIPAddresses, byte[] aBytes);

		int LJM_OpenS(final String DeviceType, final String ConnectionType,
				final String Identifier, IntByReference Handle);

		int LJM_Open(int DeviceType, int ConnectionType,
				final String Identifier, IntByReference Handle);

		int LJM_GetHandleInfo(int Handle, IntByReference DeviceType,
				IntByReference ConnectionType, IntByReference SerialNumber,
				IntByReference IPAddress, IntByReference Port,
				IntByReference MaxBytesPerMB);

		int LJM_Close(int Handle);

		int LJM_CloseAll();

		int LJM_CleanInfo(int InfoHandle);

		int LJM_eWriteAddress(int Handle, int Address, int Type, double Value);

		int LJM_eReadAddress(int Handle, int Address, int Type,
					DoubleByReference Value);

		int LJM_eWriteName(int Handle, final String Name, double Value);

		int LJM_eReadName(int Handle, final String Name,
				DoubleByReference Value);

		int LJM_eReadAddresses(int Handle, int NumFrames,
				final int[] aAddresses, final int[] aTypes, double[] aValues,
				IntByReference ErrorAddress);

		int LJM_eReadNames(int Handle, int NumFrames,
				final String[] aNames, double[] aValues,
				IntByReference ErrorAddress);

		int LJM_eWriteAddresses(int Handle, int NumFrames,
				final int[] aAddresses, final int[] aTypes,
				final double[] aValues, IntByReference ErrorAddress);

		int LJM_eWriteNames(int Handle, int NumFrames,
				final String[] aNames, final double[] aValues,
				IntByReference ErrorAddress);

		int LJM_eReadAddressArray(int Handle, int Address, int Type,
				int NumValues, double[] aValues, IntByReference ErrorAddress);

		int LJM_eReadNameArray(int Handle, final String Name, int NumValues,
				double[] aValues, IntByReference ErrorAddress);

		int LJM_eWriteAddressArray(int Handle, int Address, int Type,
				int NumValues, final double[] aValues,
				IntByReference ErrorAddress);

		int LJM_eWriteNameArray(int Handle, final String Name, int NumValues,
				final double[] aValues, IntByReference ErrorAddress);

		int LJM_eReadAddressByteArray(int Handle, int Address, int NumBytes,
				byte[] aBytes, IntByReference ErrorAddress);

		int LJM_eReadNameByteArray(int Handle, final String Name, int NumBytes,
				byte[] aBytes, IntByReference ErrorAddress);

		int LJM_eWriteAddressByteArray(int Handle, int Address, int NumBytes,
				byte[] aBytes, IntByReference ErrorAddress);

		int LJM_eWriteNameByteArray(int Handle, final String Name,
				int NumBytes, byte[] aBytes, IntByReference ErrorAddress);

		int LJM_eAddresses(int Handle, int NumFrames, final int[] aAddresses,
				final int[] aTypes, final int[] aWrites, final int[] aNumValues,
				double[] aValues, IntByReference ErrorAddress);

		int LJM_eNames(int Handle, int NumFrames, final String[] aNames,
				final int[] aWrites, final int[] aNumValues, double[] aValues,
				IntByReference ErrorAddress);

		int LJM_eReadNameString(int Handle, final String Name, Pointer string);

		int LJM_eReadAddressString(int Handle, int Address, Pointer string);

		int LJM_eWriteNameString(int Handle, final String Name,
				final String string);
		int LJM_eWriteAddressString(int Handle, int Address,
				final String string);

		int LJM_eStreamStart(int Handle, int ScansPerRead, int NumAddresses,
				final int[] aScanList, DoubleByReference ScanRate);

		int LJM_eStreamRead(int Handle, double[] aData,
				IntByReference DeviceScanBacklog,
				IntByReference LJMScanBacklog);

		int LJM_eStreamStop(int Handle);

		int LJM_StreamBurst(int Handle, int NumAddresses,
				final int[] aScanList, DoubleByReference ScanRate,
				int NumScans, double[] aData);

		int LJM_GetStreamTCPReceiveBufferStatus(int Handle,
				IntByReference ReceiveBufferBytesSize,
				IntByReference ReceiveBufferBytesBacklog); 

		int LJM_InitializeAperiodicStreamOut(int Handle, int StreamOutIndex,
				int TargetAddr, double ScanRate);
	
		int LJM_WriteAperiodicStreamOut(int Handle, int StreamOutIndex,
				int NumValues, final double[] aWriteData,
				IntByReference LJMBufferStatus);

		int LJM_PeriodicStreamOut(int Handle, int StreamOutIndex,
				int TargetAddr, double ScanRate, int NumValues,
				final double[] aWriteData);
	
		int LJM_WriteRaw(int Handle, final byte[] Data, int NumBytes);

		int LJM_ReadRaw(int Handle, byte[] Data, int NumBytes);

		int LJM_AddressesToMBFB(int MaxBytesPerMBFB, final int[] aAddresses, 
				final int[] aTypes, final int[] aWrites, final int[] aNumValues,
				final double[] aValues, IntByReference NumFrames,
				byte[] aMBFBCommand);

		int LJM_MBFBComm(int Handle, byte UnitID, byte[] aMBFB,
				IntByReference ErrorAddress);

		int LJM_UpdateValues(byte[] aMBFBResponse, final int[] aTypes,
				final int[] aWrites, final int[] aNumValues, int NumFrames,
				double[] aValues);

		int LJM_NamesToAddresses(int NumFrames, final String[] aNames,
			int[] aAddresses, int[] aTypes);

		int LJM_NameToAddress(final String Name, IntByReference Address,
				IntByReference Type);

		int LJM_AddressesToTypes(int NumAddresses, int[] aAddresses,
				int[] aTypes);

		int LJM_AddressToType(int Address, IntByReference Type);

		int LJM_LookupConstantValue(final String Scope,
				final String ConstantName, DoubleByReference ConstantValue);

		int LJM_LookupConstantName(final String Scope, double ConstantValue,
				Pointer ConstantName);

		void LJM_ErrorToString(int ErrorCode, Pointer ErrorString);

		void LJM_LoadConstants();

		int LJM_LoadConstantsFromFile(final String FileName);

		int LJM_LoadConstantsFromString(final String JsonString);

		int LJM_TCVoltsToTemp(int TCType, double TCVolts, double CJTempK,
				DoubleByReference pTCTempK);

		void LJM_FLOAT32ToByteArray(final float[] aFLOAT32, int RegisterOffset,
				int NumFLOAT32, byte[] aBytes);

		void LJM_ByteArrayToFLOAT32(final byte[] aBytes, int RegisterOffset,
				int NumFLOAT32, float[] aFLOAT32);

		void LJM_UINT16ToByteArray(final short[] aUINT16, int RegisterOffset,
				int NumUINT16, byte[] aBytes);

		void LJM_ByteArrayToUINT16(final byte[] aBytes, int RegisterOffset,
				int NumUINT16, short[] aUINT16);

		void LJM_UINT32ToByteArray(final int[] aUINT32, int RegisterOffset,
				int NumUINT32, byte[] aBytes);

		void LJM_ByteArrayToUINT32(final byte[] aBytes, int RegisterOffset,
				int NumUINT32, int[] aUINT32);

		void LJM_INT32ToByteArray(final int[] aINT32, int RegisterOffset,
				int NumINT32, byte[] aBytes);

		void LJM_ByteArrayToINT32(final byte[] aBytes, int RegisterOffset,
				int NumINT32, int[] aINT32);

		int LJM_NumberToIP(int Number, Pointer IPv4String);

		int LJM_IPToNumber(final String IPv4String, IntByReference Number);

		int LJM_NumberToMAC(long Number, Pointer MACString);

		int LJM_MACToNumber(final String MACString, LongByReference Number);

		long LJM_GetHostTick();

		void LJM_GetHostTick32Bit(IntByReference TickUpper,
				IntByReference TickLower);

		int LJM_StartInterval(int IntervalHandle, int Microseconds);

		int LJM_WaitForNextInterval(int IntervalHandle,
				IntByReference SkippedIntervals);

		int LJM_CleanInterval(int IntervalHandle);

		int LJM_WriteLibraryConfigS(final String Parameter, double Value);

		int LJM_WriteLibraryConfigStringS(final String Parameter,
				final String string);

		int LJM_ReadLibraryConfigS(final String Parameter,
				DoubleByReference Value);

		int LJM_ReadLibraryConfigStringS(final String Parameter,
				Pointer string);

		int LJM_LoadConfigurationFile(final String FileName);

		int LJM_GetSpecificIPsInfo(IntByReference InfoHandle,
				PointerByReference Info);

		int LJM_GetDeepSearchInfo(IntByReference InfoHandle, PointerByReference Info);
			
		int LJM_Log(int Level, final String string);

		int LJM_ResetLog();
	}

	private interface WindowsLabJackM extends LabJackM, StdCallLibrary {}

	/**
	 * Constants is a class containing the constants from the LJM
	 * library. The "LJM_" prefix have been removed from the original
	 * names.
	 */
	public class Constants {
		private Constants() {}

		public static final int READ = 0;
		public static final int WRITE = 1;

		public static final int UINT16 = 0;
		public static final int UINT32 = 1;
		public static final int INT32 = 2;
		public static final int FLOAT32 = 3;

		public static final int BYTE = 99;
		public static final int STRING = 98;
		public static final int STRING_MAX_SIZE = 49;

		public static final int STRING_ALLOCATION_SIZE = 50;

		public static final int INVALID_NAME_ADDRESS = -1;

		public static final int MAX_NAME_SIZE = 256;
		public static final int MAC_STRING_SIZE = 18;
		public static final int IPv4_STRING_SIZE = 16;

		public static final int BYTES_PER_REGISTER = 2;
		
		public static final int dtANY = 0;
		public static final int dtT4 = 4;
		public static final int dtT7 = 7;
		public static final int dtT8 = 8;
		public static final int dtDIGIT = 200;
		public static final int dtTSERIES = 84;

		public static final int ctANY = 0;
		public static final int ctANY_TCP = ctANY;

		public static final int ctUSB = 1;

		public static final int ctTCP = 2;
		public static final int ctNETWORK_TCP = ctTCP;
		public static final int ctETHERNET = 3;
		public static final int ctETHERNET_TCP = ctETHERNET;
		public static final int ctWIFI = 4;
		public static final int ctWIFI_TCP = ctWIFI;

		public static final int ctANY_UDP = 11;
		public static final int ctNETWORK_UDP = 5;
		public static final int ctETHERNET_UDP = 6;
		public static final int ctWIFI_UDP = 7;

		public static final int ctNETWORK_ANY = 8;
		public static final int ctETHERNET_ANY = 9;
		public static final int ctWIFI_ANY = 10;

		public static final int TCP_PORT = 502;
		public static final int ETHERNET_UDP_PORT = 52362;
		public static final int WIFI_UDP_PORT = 502;
		public static final int NO_IP_ADDRESS = 0;
		public static final int NO_PORT = 0;

		public static final String DEMO_MODE = "-2";
		public static final int idANY = 0;

		public static final int DEFAULT_FEEDBACK_ALLOCATION_SIZE = 62;
		public static final int USE_DEFAULT_MAXBYTESPERMBFB = 0;

		public static final int DEFAULT_UNIT_ID = 1;

		public static final int LIST_ALL_SIZE = 128;

		public static final int NO_TIMEOUT = 0;
		public static final int DEFAULT_USB_SEND_RECEIVE_TIMEOUT_MS = 2600;
		public static final int DEFAULT_ETHERNET_OPEN_TIMEOUT_MS = 1000;
		public static final int DEFAULT_ETHERNET_SEND_RECEIVE_TIMEOUT_MS = 2600;
		public static final int DEFAULT_WIFI_OPEN_TIMEOUT_MS = 1000;
		public static final int DEFAULT_WIFI_SEND_RECEIVE_TIMEOUT_MS = 4000;

		public static final int DUMMY_VALUE = -9999;
		public static final int SCAN_NOT_READ = -8888;
		public static final int GND = 199;

		public static final int ttB = 6001;
		public static final int ttE = 6002;
		public static final int ttJ = 6003;
		public static final int ttK = 6004;
		public static final int ttN = 6005;
		public static final int ttR = 6006;
		public static final int ttS = 6007;
		public static final int ttT = 6008;
		public static final int ttC = 6009;

		public static final String USB_SEND_RECEIVE_TIMEOUT_MS = "LJM_USB_SEND_RECEIVE_TIMEOUT_MS";
		public static final String ETHERNET_SEND_RECEIVE_TIMEOUT_MS = "LJM_ETHERNET_SEND_RECEIVE_TIMEOUT_MS";
		public static final String WIFI_SEND_RECEIVE_TIMEOUT_MS = "LJM_WIFI_SEND_RECEIVE_TIMEOUT_MS";
		public static final String SEND_RECEIVE_TIMEOUT_MS = "LJM_SEND_RECEIVE_TIMEOUT_MS";
		public static final String ETHERNET_OPEN_TIMEOUT_MS = "LJM_ETHERNET_OPEN_TIMEOUT_MS";
		public static final String WIFI_OPEN_TIMEOUT_MS = "LJM_WIFI_OPEN_TIMEOUT_MS";
		public static final String OPEN_TCP_DEVICE_TIMEOUT_MS = "LJM_OPEN_TCP_DEVICE_TIMEOUT_MS";

		public static final String DEBUG_LOG_MODE = "LJM_DEBUG_LOG_MODE";

		public static final double DEBUG_LOG_MODE_NEVER = 1;
		public static final double DEBUG_LOG_MODE_CONTINUOUS = 2;
		public static final double DEBUG_LOG_MODE_ON_ERROR = 3;

		public static final String DEBUG_LOG_LEVEL = "LJM_DEBUG_LOG_LEVEL";

		public static final double STREAM_PACKET = 1;
		public static final double TRACE = 2;
		public static final double DEBUG = 4;
		public static final double INFO = 6;
		public static final double PACKET = 7;
		public static final double WARNING = 8;
		public static final double USER = 9;
		public static final double ERROR = 10;
		public static final double FATAL = 12;

		public static final String DEBUG_LOG_BUFFER_MAX_SIZE = "LJM_DEBUG_LOG_BUFFER_MAX_SIZE";
		public static final String DEBUG_LOG_SLEEP_TIME_MS = "LJM_DEBUG_LOG_SLEEP_TIME_MS";
		public static final String LIBRARY_VERSION = "LJM_LIBRARY_VERSION";
		public static final String ALLOWS_AUTO_MULTIPLE_FEEDBACKS = "LJM_ALLOWS_AUTO_MULTIPLE_FEEDBACKS";
		public static final String ALLOWS_AUTO_CONDENSE_ADDRESSES = "LJM_ALLOWS_AUTO_CONDENSE_ADDRESSES";

		public static final String AUTO_IPS_FILE = "LJM_AUTO_IPS_FILE";
		public static final String AUTO_IPS = "LJM_AUTO_IPS";

		public static final String AUTO_RECONNECT_STICKY_CONNECTION = "LJM_AUTO_RECONNECT_STICKY_CONNECTION";
		public static final String AUTO_RECONNECT_STICKY_SERIAL = "LJM_AUTO_RECONNECT_STICKY_SERIAL";
		public static final String AUTO_RECONNECT_WAIT_MS = "LJM_AUTO_RECONNECT_WAIT_MS";

		public static final String INTERVAL_CLOCK_TYPE = "LJM_INTERVAL_CLOCK_TYPE";
		public static final double INTERVAL_CLOCK_TYPE_STEADY = 1;
		public static final double INTERVAL_CLOCK_TYPE_SYSTEM = 2;

		public static final String MODBUS_MAP_CONSTANTS_FILE = "LJM_MODBUS_MAP_CONSTANTS_FILE";
		public static final String ERROR_CONSTANTS_FILE = "LJM_ERROR_CONSTANTS_FILE";
		public static final String DEBUG_LOG_FILE = "LJM_DEBUG_LOG_FILE";
		public static final String CONSTANTS_FILE = "LJM_CONSTANTS_FILE";
		public static final String DEBUG_LOG_FILE_MAX_SIZE = "LJM_DEBUG_LOG_FILE_MAX_SIZE";

		public static final String DEEP_SEARCH_FILE = "LJM_DEEP_SEARCH_FILE";

		public static final String SPECIFIC_IPS_FILE = "LJM_SPECIFIC_IPS_FILE";

		public static final String STREAM_AIN_BINARY = "LJM_STREAM_AIN_BINARY";

		public static final String STREAM_DIGITAL_AUTO_RECOVERY_ERROR_DETECTION_DISABLED = "LJM_STREAM_DIGITAL_AUTO_RECOVERY_ERROR_DETECTION_DISABLED";

		public static final String STREAM_SCANS_RETURN = "LJM_STREAM_SCANS_RETURN";
		public static final double STREAM_SCANS_RETURN_ALL = 1;
		public static final double STREAM_SCANS_RETURN_ALL_OR_NONE = 2;

		public static final String STREAM_RECEIVE_TIMEOUT_MODE = "LJM_STREAM_RECEIVE_TIMEOUT_MODE";
		public static final double STREAM_RECEIVE_TIMEOUT_MODE_CALCULATED = 1;
		public static final double STREAM_RECEIVE_TIMEOUT_MODE_MANUAL = 2;

		public static final String STREAM_TCP_RECEIVE_BUFFER_SIZE = "LJM_STREAM_TCP_RECEIVE_BUFFER_SIZE";

		public static final String STREAM_THREADS_PRIORITY_MODE = "LJM_STREAM_THREADS_PRIORITY_MODE";
		public static final double STREAM_THREADS_PRIORITY_AUTO_ELEVATED = 1;
		public static final double STREAM_THREADS_PRIORITY_UNALTERED = 2;

		public static final String STREAM_PROCESS_PRIORITY_MODE = "LJM_STREAM_PROCESS_PRIORITY_MODE";
		public static final double STREAM_PROCESS_PRIORITY_ELEVATED = 1;
		public static final double STREAM_PROCESS_PRIORITY_UNALTERED = 2;

		public static final String STREAM_RECEIVE_TIMEOUT_MS = "LJM_STREAM_RECEIVE_TIMEOUT_MS";

		public static final String STREAM_TRANSFERS_PER_SECOND = "LJM_STREAM_TRANSFERS_PER_SECOND";
		public static final String RETRY_ON_TRANSACTION_ID_MISMATCH = "LJM_RETRY_ON_TRANSACTION_ID_MISMATCH";
		public static final String OLD_FIRMWARE_CHECK = "LJM_OLD_FIRMWARE_CHECK";

		public static final String USE_TCP_INIT_FOR_T7_WIFI_TCP = "LJM_USE_TCP_INIT_FOR_T7_WIFI_TCP";

		public static final String ZERO_LENGTH_ARRAY_MODE = "LJM_ZERO_LENGTH_ARRAY_MODE";
		public static final double ZERO_LENGTH_ARRAY_ERROR = 1;
		public static final double ZERO_LENGTH_ARRAY_IGNORE_OPERATION = 2;

		/**
		 * @deprecated Replaced by {@link #TCP_PORT}
		 */
		@Deprecated public static final int DEFAULT_PORT = 502;
		/**
		 * @deprecated Replaced by {@link #ETHERNET_UDP_PORT} and
		 * {@link #WIFI_UDP_PORT}
		 */
		@Deprecated public static final int UDP_PORT = 52362;
		/**
		 * @deprecated Maximum packet size should instead be read
		 * with {@link #getHandleInfo}
		 */
		@Deprecated public static final int MAX_TCP_PACKET_NUM_BYTES_T7 = 1040;
		/**
		 * @deprecated Maximum packet size should instead be read
		 * with {@link #getHandleInfo}
		 */
		@Deprecated public static final int MAX_USB_PACKET_NUM_BYTES = 64;
		/**
		 * @deprecated Maximum packet size should instead be read
		 * with {@link #getHandleInfo}
		 */
		@Deprecated public static final int MAX_ETHERNET_PACKET_NUM_BYTES_T7 = 1040;
		/**
		 * @deprecated Maximum packet size should instead be read
		 * with {@link #getHandleInfo}
		 */
		@Deprecated public static final int MAX_WIFI_PACKET_NUM_BYTES_T7 = 500;
		/**
		 * @deprecated Replaced by {@link #SPECIFIC_IPS_FILE}
		 */
		@Deprecated public static final String SPECIAL_ADDRESSES_FILE = "LJM_SPECIAL_ADDRESSES_FILE";
		/**
		 * @deprecated Instead use {@link #getSpecificIPsInfo}
		 */
		@Deprecated public static final String SPECIAL_ADDRESSES_STATUS = "LJM_SPECIAL_ADDRESSES_STATUS";
		/**
		 * @deprecated
		 */
		@Deprecated public static final String OPEN_MODE = "LJM_OPEN_MODE";
		/**
		 * @deprecated
		 */
		@Deprecated public static final double KEEP_OPEN = 1;
		/**
		 * @deprecated
		 */
		@Deprecated public static final double OPEN_CLOSE = 2;
	}

	/**
	 * Errors is an enum containing the error constants from the LJM
	 * library. The "LJME_" prefix have been removed from the
	 * original names.
	 */
	public enum Errors {
		NOERROR(0),
		WARNINGS_BEGIN(200),
		WARNINGS_END(399),
		FRAMES_OMITTED_DUE_TO_PACKET_SIZE(201),
		DEBUG_LOG_FAILURE(202),
		USING_DEFAULT_CALIBRATION(203),
		DEBUG_LOG_FILE_NOT_OPEN(204),
		MODBUS_ERRORS_BEGIN(1200),
		MODBUS_ERRORS_END(1216),
		MBE1_ILLEGAL_FUNCTION(1201),
		MBE2_ILLEGAL_DATA_ADDRESS(1202),
		MBE3_ILLEGAL_DATA_VALUE(1203),
		MBE4_SLAVE_DEVICE_FAILURE(1204),
		MBE5_ACKNOWLEDGE(1205),
		MBE6_SLAVE_DEVICE_BUSY(1206),
		MBE8_MEMORY_PARITY_ERROR(1208),
		MBE10_GATEWAY_PATH_UNAVAILABLE(1210),
		MBE11_GATEWAY_TARGET_NO_RESPONSE(1211),
		LIBRARY_ERRORS_BEGIN(1220),
		LIBRARY_ERRORS_END(1399),
		UNKNOWN_ERROR(1221),
		INVALID_DEVICE_TYPE(1222),
		INVALID_HANDLE(1223),
		DEVICE_NOT_OPEN(1224),
		STREAM_NOT_INITIALIZED(1225),
		DEVICE_NOT_FOUND(1227),
		APERIODIC_STREAM_OUT_NOT_INITIALIZED(1228),
		DEVICE_ALREADY_OPEN(1229),
		DEVICE_CURRENTLY_CLAIMED_BY_ANOTHER_PROCESS(1230),
		CANNOT_CONNECT(1231),
		STREAM_OUT_INDEX_OUT_OF_RANGE(1232),
		SOCKET_LEVEL_ERROR(1233),
		SCAN_RATE_INCONSISTENT(1234),
		CANNOT_OPEN_DEVICE(1236),
		CANNOT_DISCONNECT(1237),
		WINSOCK_FAILURE(1238),
		RECONNECT_FAILED(1239),
		CONNECTION_HAS_YIELDED_RECONNECT_FAILED(1240),
		USB_FAILURE(1241),
		STREAM_FLUSH_TIMEOUT(1242),
		U3_NOT_SUPPORTED_BY_LJM(1243),
		U6_NOT_SUPPORTED_BY_LJM(1246),
		UE9_NOT_SUPPORTED_BY_LJM(1249),
		INVALID_ADDRESS(1250),
		INVALID_CONNECTION_TYPE(1251),
		INVALID_DIRECTION(1252),
		INVALID_FUNCTION(1253),
		INVALID_NUM_REGISTERS(1254),
		INVALID_PARAMETER(1255),
		INVALID_PROTOCOL_ID(1256),
		INVALID_TRANSACTION_ID(1257),
		NUM_WRITES_LARGER_THAN_AVAILABLE_SPACE(1258),
		UNKNOWN_VALUE_TYPE(1259),
		MEMORY_ALLOCATION_FAILURE(1260),
		NO_COMMAND_BYTES_SENT(1261),
		INCORRECT_NUM_COMMAND_BYTES_SENT(1262),
		NO_RESPONSE_BYTES_RECEIVED(1263),
		INCORRECT_NUM_RESPONSE_BYTES_RECEIVED(1264),
		MIXED_FORMAT_IP_ADDRESS(1265),
		UNKNOWN_IDENTIFIER(1266),
		NOT_IMPLEMENTED(1267),
		INVALID_INDEX(1268),
		INVALID_LENGTH(1269),
		ERROR_BIT_SET(1270),
		INVALID_MAXBYTESPERMBFB(1271),
		NULL_POINTER(1272),
		NULL_OBJ(1273),
		RESERVED_NAME(1274),
		UNPARSABLE_DEVICE_TYPE(1275),
		UNPARSABLE_CONNECTION_TYPE(1276),
		UNPARSABLE_IDENTIFIER(1277),
		PACKET_SIZE_TOO_LARGE(1278),
		TRANSACTION_ID_ERR(1279),
		PROTOCOL_ID_ERR(1280),
		LENGTH_ERR(1281),
		UNIT_ID_ERR(1282),
		FUNCTION_ERR(1283),
		STARTING_REG_ERR(1284),
		NUM_REGS_ERR(1285),
		NUM_BYTES_ERR(1286),
		CONFIG_FILE_NOT_FOUND(1289),
		CONFIG_PARSING_ERROR(1290),
		INVALID_NUM_VALUES(1291),
		CONSTANTS_FILE_NOT_FOUND(1292),
		INVALID_CONSTANTS_FILE(1293),
		INVALID_NAME(1294),
		OVERSPECIFIED_PORT(1296),
		INTENT_NOT_READY(1297),
		ATTR_LOAD_COMM_FAILURE(1298),
		INVALID_CONFIG_NAME(1299),
		ERROR_RETRIEVAL_FAILURE(1300),
		LJM_BUFFER_FULL(1301),
		COULD_NOT_START_STREAM(1302),
		STREAM_NOT_RUNNING(1303),
		UNABLE_TO_STOP_STREAM(1304),
		INVALID_VALUE(1305),
		SYNCHRONIZATION_TIMEOUT(1306),
		OLD_FIRMWARE(1307),
		CANNOT_READ_OUT_ONLY_STREAM(1308),
		NO_SCANS_RETURNED(1309),
		TEMPERATURE_OUT_OF_RANGE(1310),
		VOLTAGE_OUT_OF_RANGE(1311),
		FUNCTION_DOES_NOT_SUPPORT_THIS_TYPE(1312),
		INVALID_INFO_HANDLE(1313),
		NO_DEVICES_FOUND(1314),
		AUTO_IPS_FILE_NOT_FOUND(1316),
		AUTO_IPS_FILE_INVALID(1317),
		INVALID_INTERVAL_HANDLE(1318),
		NAMED_MUTEX_PERMISSION_DENIED(1319),
		DIGITAL_AUTO_RECOVERY_ERROR_DETECTED(1320),
		NEGATIVE_RECEIVE_BUFFER_SIZE(1321),

		/**
		 * @deprecated Replaced by {@link #DEVICE_CURRENTLY_CLAIMED_BY_ANOTHER_PROCESS}
		 */
		@Deprecated COULD_NOT_CLAIM_DEVICE(1230),
		/**
		 * @deprecated Replaced by {@link #U3_NOT_SUPPORTED_BY_LJM}
		 */
		@Deprecated U3_CANNOT_BE_OPENED_BY_LJM(1243),
		/**
		 * @deprecated Replaced by {@link #U6_NOT_SUPPORTED_BY_LJM}
		 */
		@Deprecated U6_CANNOT_BE_OPENED_BY_LJM(1246),
		/**
		 * @deprecated Replaced by {@link #UE9_NOT_SUPPORTED_BY_LJM}
		 */
		@Deprecated UE9_CANNOT_BE_OPENED_BY_LJM(1249),
		/**
		 * @deprecated Replaced by {@link #UNKNOWN_VALUE_TYPE}
		 */
		@Deprecated INVALID_VALUE_TYPE(1259);

		private final int value;

		private Errors(int value) {
			this.value = value;
		};

		/**
		 * @return The error value.
		 */
		public int getValue() {
			return value;
		};
	} 

	/* Helper methods */
	private static void handleError(int error) {
		if(error != LJM.Errors.NOERROR.getValue()) {
			throw new LJMException(error);
		}
	}

	private static void handleError(int error, int errorAddress) {
		if(error != LJM.Errors.NOERROR.getValue()) {
			throw new LJMException(error, errorAddress);
		}
	}

	/* LJM wrapper methods */
	public static int listAll(int deviceType, int connectionType, 
			IntByReference numFound, int[] aDeviceTypes, int[] aConnectionTypes,
			int[] aSerialNumbers, int[] aIPAddresses) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_ListAll(deviceType, connectionType,
				numFound, aDeviceTypes, aConnectionTypes, aSerialNumbers,
				aIPAddresses);
		LJM.handleError(error);
		return error;
	}

	public static int listAllS(final String deviceType,
			final String connectionType, IntByReference numFound,
			int[] aDeviceTypes, int[] aConnectionTypes, int[] aSerialNumbers,
			int[] aIPAddresses) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_ListAllS(deviceType, connectionType,
				numFound, aDeviceTypes, aConnectionTypes, aSerialNumbers,
				aIPAddresses);
		LJM.handleError(error);
		return error;
	}

	public static int listAllExtended(int deviceType, int connectionType,
			int numAddresses, final int[] aAddresses, final int[] aNumRegs,
			int maxNumFound, IntByReference numFound, int[] aDeviceTypes,
			int[] aConnectionTypes, int[] aSerialNumbers, int[] aIPAddresses,
			byte[] aBytes) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_ListAllExtended(deviceType,
				connectionType, numAddresses, aAddresses, aNumRegs, maxNumFound,
				numFound, aDeviceTypes, aConnectionTypes, aSerialNumbers,
				aIPAddresses, aBytes);
		LJM.handleError(error);
		return error;
	}

	public static int openS(final String deviceType,
			final String connectionType, final String identifier,
			IntByReference handle) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_OpenS(deviceType, connectionType,
				identifier, handle);
		LJM.handleError(error);
		return error;
	}

	public static int open(int deviceType, int connectionType,
			final String identifier, IntByReference handle) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_Open(deviceType, connectionType,
				identifier, handle);
		LJM.handleError(error);
		return error;
	}

	public static int getHandleInfo(int handle, IntByReference deviceType,
			IntByReference connectionType, IntByReference serialNumber,
			IntByReference ipAddress, IntByReference port,
			IntByReference maxBytesPerMB) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_GetHandleInfo(handle, deviceType,
				connectionType, serialNumber, ipAddress, port, maxBytesPerMB);
		LJM.handleError(error);
		return error;
	}

	public static int close(int handle)	{
		int error = 0;
		error = LabJackM.INSTANCE.LJM_Close(handle);
		LJM.handleError(error);
		return error;
	}

	public static int closeAll() {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_CloseAll();
		LJM.handleError(error);
		return error;
	}

	public static int cleanInfo(int infoHandle) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_CleanInfo(infoHandle);
		LJM.handleError(error);
		return error;
	}

	public static int eWriteAddress(int handle, int address, int type,
			double value) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteAddress(handle, address, type, 
				value);
		LJM.handleError(error);
		return error;
	}

	public static int eReadAddress(int handle, int address, int type,
			DoubleByReference value) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadAddress(handle, address, type,
				value);
		LJM.handleError(error);
		return error;
	}

	public static int eWriteName(int handle, final String name,
			double value) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteName(handle, name, value);
		LJM.handleError(error);
		return error;
	}

	public static int eReadName(int handle, final String name,
			DoubleByReference value) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadName(handle, name, value);
		LJM.handleError(error);
		return error;
	}

	public static int eReadAddresses(int handle, int numFrames,
			final int[] aAddresses, final int[] aTypes, double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadAddresses(handle, numFrames,
				aAddresses, aTypes, aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eReadNames(int handle, int numFrames,
			final String[] aNames, double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadNames(handle, numFrames, aNames,
				aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eWriteAddresses(int handle, int numFrames,
			final int[] aAddresses, final int[] aTypes, final double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteAddresses(handle, numFrames,
				aAddresses, aTypes, aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eWriteNames(int handle, int numFrames,
			final String[] aNames, final double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteNames(handle, numFrames, aNames,
				aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eReadAddressArray(int handle, int address, int type,
			int numValues, double[] aValues, IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadAddressArray(handle, address, type,
				numValues, aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eReadNameArray(int handle, final String name,
			int numValues, double[] aValues, IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadNameArray(handle, name, numValues,
				aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eWriteAddressArray(int handle, int address, int type,
			int numValues, final double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteAddressArray(handle, address, type,
				numValues, aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eWriteNameArray(int handle, final String name,
			int numValues, final double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteNameArray(handle, name, numValues,
				aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eReadAddressByteArray(int handle, int address,
			int numBytes, byte[] aBytes, IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadAddressByteArray(handle, address,
				numBytes, aBytes, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eReadNameByteArray(int handle, final String name,
			int numBytes, byte[] aBytes, IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadNameByteArray(handle, name,
				numBytes, aBytes, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eWriteAddressByteArray(int handle, int address,
			int numBytes, final byte[] aBytes, IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteAddressByteArray(handle, address,
				numBytes, aBytes, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eWriteNameByteArray(int handle, final String name,
			int numBytes, final byte[] aBytes, IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteNameByteArray(handle, name,
				numBytes, aBytes, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eAddresses(int handle, int numFrames,
			final int[] aAddresses, final int[] aTypes, final int[] aWrites,
			final int[] aNumValues, double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eAddresses(handle, numFrames, aAddresses,
				aTypes, aWrites, aNumValues, aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eNames(int handle, int numFrames, final String[] aNames,
			final int[] aWrites, final int[] aNumValues, double[] aValues,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eNames(handle, numFrames, aNames, aWrites,
				aNumValues, aValues, errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int eReadNameString(int handle, final String name,
			Pointer string) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadNameString(handle, name, string);
		LJM.handleError(error);
		return error;
	}

	public static int eReadAddressString(int handle, int address,
			Pointer string) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eReadAddressString(handle, address,
				string);
		LJM.handleError(error);
		return error;
	}

	public static int eWriteNameString(int handle, final String name,
			final String string) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteNameString(handle, name, string);
		LJM.handleError(error);
		return error;
	}

	public static int eWriteAddressString(int handle, int address,
			final String string) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eWriteAddressString(handle, address, 
				string);
		LJM.handleError(error);
		return error;
	}

	public static int eStreamStart(int handle, int scansPerRead,
			int numAddresses, final int[] aScanList,
			DoubleByReference scanRate) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eStreamStart(handle, scansPerRead,
				numAddresses, aScanList, scanRate);
		LJM.handleError(error);
		return error;
	}

	public static int eStreamRead(int handle, double[] aData,
			IntByReference deviceScanBacklog,
			IntByReference ljmScanBacklog) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eStreamRead(handle, aData, 
				deviceScanBacklog, ljmScanBacklog);
		LJM.handleError(error);
		return error;
	}

	public static int eStreamStop(int handle) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_eStreamStop(handle);
		LJM.handleError(error);
		return error;
	}

	public static int streamBurst(int handle, int numAddresses,
			final int[] aScanList, DoubleByReference scanRate, int numScans,
			double[] aData) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_StreamBurst(handle, numAddresses,
				aScanList, scanRate, numScans, aData);
		LJM.handleError(error);
		return error;
	}

	public static int getStreamTCPReceiveBufferStatus(int handle,
			IntByReference receiveBufferBytesSize,
			IntByReference receiveBufferBytesBacklog) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_GetStreamTCPReceiveBufferStatus(handle,
				receiveBufferBytesSize, receiveBufferBytesBacklog);
		LJM.handleError(error);
		return error;
	}

	public static int initializeAperiodicStreamOut(int handle,
			int streamOutIndex, int targetAddr, double scanRate) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_InitializeAperiodicStreamOut(handle,
				streamOutIndex, targetAddr, scanRate);
		LJM.handleError(error);
		return error;
	} 

	public static int writeAperiodicStreamOut(int handle, int streamOutIndex,
			int numValues, final double[] aWriteData,
			IntByReference ljmBufferStatus) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_WriteAperiodicStreamOut(handle,
				streamOutIndex, numValues, aWriteData, ljmBufferStatus);
		LJM.handleError(error);
		return error;
	}

	public static int periodicStreamOut(int handle, int streamOutIndex,
			int targetAddr, double scanRate, int numValues,
			final double[] aWriteData) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_PeriodicStreamOut(handle, streamOutIndex,
				targetAddr, scanRate, numValues, aWriteData);
		LJM.handleError(error);
		return error;
	}

	public static int writeRaw(int handle, final byte[] data, int numBytes) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_WriteRaw(handle, data, numBytes);
		LJM.handleError(error);
		return error;
	}

	public static int readRaw(int handle, byte[] data, int numBytes) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_ReadRaw(handle, data, numBytes);
		LJM.handleError(error);
		return error;
	}

	public static int addressesToMBFB(int maxBytesPerMBFB,
			final int[] aAddresses,  final int[] aTypes, final int[] aWrites,
			final int[] aNumValues, final double[] aValues,
			IntByReference numFrames, byte[] aMBFBCommand) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_AddressesToMBFB(maxBytesPerMBFB,
				aAddresses,  aTypes, aWrites, aNumValues, aValues, numFrames,
				aMBFBCommand);
		LJM.handleError(error);
		return error;
	}

	public static int mbfbComm(int handle, byte unitID, byte[] aMBFB,
			IntByReference errorAddress) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_MBFBComm(handle, unitID, aMBFB,
				errorAddress);
		LJM.handleError(error, errorAddress.getValue());
		return error;
	}

	public static int updateValues(byte[] aMBFBResponse, final int[] aTypes,
			final int[] aWrites, final int[] aNumValues, int numFrames,
			double[] aValues) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_UpdateValues(aMBFBResponse, aTypes,
				aWrites, aNumValues, numFrames, aValues);
		LJM.handleError(error);
		return error;
	}

	public static int namesToAddresses(int numFrames, final String[] aNames,
			int[] aAddresses, int[] aTypes) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_NamesToAddresses(numFrames, aNames,
				aAddresses, aTypes);
		LJM.handleError(error);
		return error;
	}

	public static int nameToAddress(final String name, IntByReference address,
				IntByReference type) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_NameToAddress(name, address, type);
		LJM.handleError(error);
		return error;
	}

	public static int addressesToTypes(int numAddresses, int[] aAddresses,
			int[] aTypes) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_AddressesToTypes(numAddresses, aAddresses,
				aTypes);
		LJM.handleError(error);
		return error;
	}

	public static int addressToType(int address, IntByReference type) {
			int error = 0;
		error = LabJackM.INSTANCE.LJM_AddressToType(address, type);
		LJM.handleError(error);
		return error;
	}

	public static int lookupConstantValue(final String scope,
			final String constantName, DoubleByReference constantValue) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_LookupConstantValue(scope, constantName,
				constantValue);
		LJM.handleError(error);
		return error;
	}

	public static int lookupConstantName(final String scope,
			double constantValue, Pointer constantName) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_LookupConstantName(scope, constantValue,
				constantName);
		LJM.handleError(error);
		return error;
	}

	public static void errorToString(int errorCode, Pointer errorString) {
		LabJackM.INSTANCE.LJM_ErrorToString(errorCode, errorString);
	}

	public static void loadConstants() {
		LabJackM.INSTANCE.LJM_LoadConstants();
	}

	public static int loadConstantsFromFile(final String fileName) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_LoadConstantsFromFile(fileName);
		LJM.handleError(error);
		return error;
	}

	public static int loadConstantsFromString(final String jsonString) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_LoadConstantsFromString(jsonString);
		LJM.handleError(error);
		return error;
	}

	public static int tcVoltsToTemp(int tcType, double tcVolts, double cjTempK,
		DoubleByReference pTCTempK) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_TCVoltsToTemp(tcType, tcVolts, cjTempK, 
				pTCTempK);
		LJM.handleError(error);
		return error;
	}

	public static void float32ToByteArray(final float[] aFLOAT32,
			int registerOffset, int numFLOAT32, byte[] aBytes) {
		LabJackM.INSTANCE.LJM_FLOAT32ToByteArray(aFLOAT32, registerOffset,
				numFLOAT32, aBytes);
	}

	public static void byteArrayToFLOAT32(final byte[] aBytes,
			int registerOffset, int numFLOAT32, float[] aFLOAT32) {
		LabJackM.INSTANCE.LJM_ByteArrayToFLOAT32(aBytes, registerOffset,
				numFLOAT32, aFLOAT32);
	}

	public static void uint16ToByteArray(final short[] aUINT16,
			int registerOffset, int numUINT16, byte[] aBytes) {
		LabJackM.INSTANCE.LJM_UINT16ToByteArray(aUINT16, registerOffset,
				numUINT16, aBytes);
	}

	public static void byteArrayToUINT16(final byte[] aBytes,
			int registerOffset, int numUINT16, short[] aUINT16) {
		LabJackM.INSTANCE.LJM_ByteArrayToUINT16(aBytes, registerOffset,
				numUINT16, aUINT16);
	}

	public static void uint32ToByteArray(final int[] aUINT32,
			int registerOffset, int numUINT32, byte[] aBytes) {
		LabJackM.INSTANCE.LJM_UINT32ToByteArray(aUINT32, registerOffset,
				numUINT32, aBytes);
	}

	public static void byteArrayToUINT32(final byte[] aBytes,
			int registerOffset, int numUINT32, int[] aUINT32) {
		LabJackM.INSTANCE.LJM_ByteArrayToUINT32(aBytes, registerOffset,
				numUINT32, aUINT32);
	}

	public static void int32ToByteArray(final int[] aINT32, int registerOffset,
			int numINT32, byte[] aBytes) {
		LabJackM.INSTANCE.LJM_INT32ToByteArray(aINT32, registerOffset, numINT32,
				aBytes);
	}

	public static void byteArrayToINT32(final byte[] aBytes, int registerOffset,
			int numINT32, int[] aINT32) {
		LabJackM.INSTANCE.LJM_ByteArrayToINT32(aBytes, registerOffset, numINT32,
				aINT32);
	}

	public static int numberToIP(int number, Pointer ipv4String) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_NumberToIP(number, ipv4String);
		LJM.handleError(error);
		return error;
	}

	public static int ipToNumber(final String ipv4String,
			IntByReference number) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_IPToNumber(ipv4String, number);
		LJM.handleError(error);
		return error;
	}

	public static int numberToMAC(long number, Pointer macString) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_NumberToMAC(number, macString);
		LJM.handleError(error);
		return error;
	}

	public static int macToNumber(final String macString,
			LongByReference number) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_MACToNumber(macString, number);
		LJM.handleError(error);
		return error;
	}

	public static long getHostTick() {
		return LabJackM.INSTANCE.LJM_GetHostTick();
	}

	public static void getHostTick32Bit(IntByReference TickUpper,
				IntByReference TickLower) {
		LabJackM.INSTANCE.LJM_GetHostTick32Bit(TickUpper, TickLower);
	}

	public static int startInterval(int intervalHandle, int microseconds) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_StartInterval(intervalHandle,
				microseconds);
		LJM.handleError(error);
		return error;
	}

	public static int waitForNextInterval(int intervalHandle,
			IntByReference skippedIntervals) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_WaitForNextInterval(intervalHandle,
				skippedIntervals);
		LJM.handleError(error);
		return error;
	}

	public static int cleanInterval(int intervalHandle) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_CleanInterval(intervalHandle);
		LJM.handleError(error);
		return error;
	}

	public static int writeLibraryConfigS(final String parameter,
			double value) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_WriteLibraryConfigS(parameter, value);
		LJM.handleError(error);
		return error;
	}

	public static int writeLibraryConfigStringS(final String parameter,
			final String string) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_WriteLibraryConfigStringS(parameter,
				string);
		LJM.handleError(error);
		return error;
	}

	public static int readLibraryConfigS(final String parameter,
			DoubleByReference value) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_ReadLibraryConfigS(parameter, value);
		LJM.handleError(error);
		return error;
	}

	public static int readLibraryConfigStringS(final String parameter,
			Pointer string) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_ReadLibraryConfigStringS(parameter, string);
		LJM.handleError(error);
		return error;
	}

	public static int loadConfigurationFile(final String fileName) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_LoadConfigurationFile(fileName);
		LJM.handleError(error);
		return error;
	}

	public static int getSpecificIPsInfo(IntByReference infoHandle,
			PointerByReference info) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_GetSpecificIPsInfo(infoHandle, info);
		LJM.handleError(error);
		return error;
	}

	public static int getDeepSearchInfo(IntByReference infoHandle, PointerByReference info) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_GetDeepSearchInfo(infoHandle, info);
		LJM.handleError(error);
		return error;
	}

	public static int log(int level, final String string) {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_Log(level, string);
		LJM.handleError(error);
		return error;
	}

	public static int resetLog() {
		int error = 0;
		error = LabJackM.INSTANCE.LJM_ResetLog();
		LJM.handleError(error);
		return error;
	}

	public LJM() {}
}
