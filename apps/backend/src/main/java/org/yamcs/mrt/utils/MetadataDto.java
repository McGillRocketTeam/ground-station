package org.yamcs.mrt.utils;

public final class MetadataDto {
    public String frequency;
    public String status;
    public String long_status;

    public void validate() {
        if (frequency == null) {
            throw new IllegalArgumentException("Missing required field: frequency");
        }
        if (status == null) {
            throw new IllegalArgumentException("Missing required field: status");
        }
        if (long_status == null) {
            throw new IllegalArgumentException("Missing required field: long_status");
        }
    }
}
