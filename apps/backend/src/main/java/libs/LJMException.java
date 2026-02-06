package libs;

import com.sun.jna.*;
import com.sun.jna.ptr.*;


/**
 * LJMException is a custom exception class for the LJM class. It
 * takes error and errorAddress values returned from LJM library
 * function calls, will get the string error from the LJM library and
 * setup exception strings with them.
 *
 * @author LabJack Corporation {@literal <}support@labjack.com{@literal >}
 */
public class LJMException extends RuntimeException {
	private int error;
	private int errorAddress;
	private String errorString;
	private String message;

	public LJMException(int error) {
		this.error = error;
		this.errorAddress = -1;
		setErrorString();
		setMessage();
	}

	public LJMException(int error, int errorAddress) {
		this.error = error;
		this.errorAddress = errorAddress;
		setErrorString();
		setMessage();
	}

	public int getError() {
		return error;
	}

	public int getErrorAddress() {
		return errorAddress;
	}

	public int getErrorString() {
		return error;
	}

	@Override
	public String toString() {
		return getClass().getName() + ": " + message;
	}

	@Override
	public String getMessage() {
		return message;
	}

	//Sets errorString. Call after setting error.
	private void setErrorString() {
		try {
			Pointer errorStringPtr = new Memory(LJM.Constants.MAX_NAME_SIZE);
			LJM.errorToString(error, errorStringPtr);
			errorString = errorStringPtr.getString(0);
		}
		catch(Exception e) {
			//Error occured, just set to blank
			errorString = "";
		}
	}

	//Sets message. Call after setting error, errorAddress and errorString.
	private void setMessage() {
		message = "LJM error " + error;
		if(!errorString.isEmpty()) {
			message += " " + errorString;
		}
		if(errorAddress >= 0) {
			//Valid address
			message += " at address " + errorAddress;
		}
	}
}
