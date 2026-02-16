package org.yamcs.mrt.utils;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class DeviceFrequencyManager {

    private final Map<String, String> deviceToFrequency = new HashMap<>();

    private final Map<String, FrequencyBucket> frequencyBuckets = new HashMap<>();

    public void addOrUpdateDevice(String device, String frequency) {

        removeDevice(device); // remove old mapping if exists

        deviceToFrequency.put(device, frequency);

        FrequencyBucket bucket = frequencyBuckets.computeIfAbsent(
                frequency, f -> new FrequencyBucket());

        bucket.devices.add(device);

        // If no selected device yet, pick this one
        if (bucket.selectedDevice == null) {
            bucket.selectedDevice = device;
        }
    }

    public void removeDevice(String device) {
        String frequency = deviceToFrequency.remove(device);
        if (frequency == null)
            return;

        FrequencyBucket bucket = frequencyBuckets.get(frequency);
        if (bucket == null)
            return;

        bucket.devices.remove(device);

        // If we removed the selected device, pick another
        if (device.equals(bucket.selectedDevice)) {
            bucket.selectedDevice = bucket.devices.stream()
                    .findAny()
                    .orElse(null);
        }

        if (bucket.devices.isEmpty()) {
            frequencyBuckets.remove(frequency);
        }
    }

    public String getSelectedDevice(String frequency) {
        FrequencyBucket bucket = frequencyBuckets.get(frequency);
        return bucket == null ? null : bucket.selectedDevice;
    }

    public Set<String> getAllSelectedDevices() {
        Set<String> result = new HashSet<>();

        for (FrequencyBucket bucket : frequencyBuckets.values()) {
            if (bucket.selectedDevice != null) {
                result.add(bucket.selectedDevice);
            }
        }

        return result;
    }

    public Set<String> getDevices(String frequency) {
        FrequencyBucket bucket = frequencyBuckets.get(frequency);
        return bucket == null
                ? Collections.emptySet()
                : bucket.devices;
    }

    public String getFrequency(String device) {
        return deviceToFrequency.get(device);
    }

    public static class FrequencyBucket {
        Set<String> devices = new HashSet<>();
        String selectedDevice;
    }
}
