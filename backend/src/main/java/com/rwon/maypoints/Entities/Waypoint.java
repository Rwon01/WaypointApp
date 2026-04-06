package com.rwon.maypoints.Entities;


import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Objects;
import java.util.UUID;

@Document(collection = "waypoints")
public class Waypoint {
    public Waypoint(String id, String name, int x, int z, String color) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.z = z;
        this.color = color;
    }

    public Waypoint(){
    }
    public Waypoint(UUID id, String name, int x, int z) {
        this.id = UUID.randomUUID().toString();
        this.name = name;
        this.x = x;
        this.z = z;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        Waypoint waypoint = (Waypoint) o;
        return Objects.equals(id, waypoint.id);
    }

    @Override
    public String toString() {
        return "Waypoint{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", x=" + x +
                ", z=" + z +
                '}';
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Id()
    private String id;

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
}
