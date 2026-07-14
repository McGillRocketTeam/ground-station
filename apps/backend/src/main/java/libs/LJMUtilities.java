package libs;

import com.sun.jna.Memory;
import com.sun.jna.Pointer;
import com.sun.jna.ptr.IntByReference;
import libs.LJM;
import libs.LJMException;

public class LJMUtilities {

	public static void printDeviceInfo(int handle) {
		IntByReference devTypeRef = new IntByReference(0);
		IntByReference connTypeRef = new IntByReference(0);
		IntByReference serNumRef = new IntByReference(0);
		IntByReference ipAddrRef = new IntByReference(0);
		IntByReference portRef = new IntByReference(0);
		IntByReference maxBytesRef = new IntByReference(0);
		Pointer ipStrPtr = new Memory(LJM.Constants.IPv4_STRING_SIZE);

		LJM.getHandleInfo(handle, devTypeRef, connTypeRef, serNumRef,
				ipAddrRef, portRef, maxBytesRef);

		LJM.numberToIP(ipAddrRef.getValue(), ipStrPtr);

		System.out.println("Opened a LabJack with Device type: "
				+ devTypeRef.getValue() + ", Connection type: "
				+ connTypeRef.getValue() + ",");
		System.out.println("  Serial number: " + serNumRef.getValue()
				+ ", IP address: " + ipStrPtr.getString(0) + ", Port: "
				+ portRef.getValue());
		System.out.println("  Max bytes per MB: " + maxBytesRef.getValue());
	}

	public static int getDeviceType(int handle) {
		IntByReference devTypeRef = new IntByReference(0);
		IntByReference connTypeRef = new IntByReference(0);
		IntByReference serNumRef = new IntByReference(0);
		IntByReference ipAddrRef = new IntByReference(0);
		IntByReference portRef = new IntByReference(0);
		IntByReference maxBytesRef = new IntByReference(0);

		LJM.getHandleInfo(handle, devTypeRef, connTypeRef, serNumRef,
				ipAddrRef, portRef, maxBytesRef);

		return devTypeRef.getValue();
	}

	public LJMUtilities() {}
}
