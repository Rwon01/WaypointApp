package com.rwon.maypoints.Entities;

public class WaypointDto {
    private String Id;
    private String name;
    private int x;
    private int z;
    private String color;

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public WaypointDto() {
    }

    public WaypointDto(String id, String name, int x, int z, String color) {
        Id = id;
        this.name = name;
        this.x = x;
        this.z = z;
        this.color = color;
    }

    public WaypointDto(String id, String name, int x, int z) {
        Id = id;
        this.name = name;
        this.x = x;
        this.z = z;
    }

    public String getId() {
        return Id;
    }

    public void setId(String id) {
        Id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getX() {
        return x;
    }

    public void setX(int x) {
        this.x = x;
    }

    public int getZ() {
        return z;
    }
    public void setZ(int z) {
        this.z = z;
    }
}
