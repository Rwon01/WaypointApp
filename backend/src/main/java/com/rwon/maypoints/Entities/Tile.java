package com.rwon.maypoints.Entities;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "tiles")
public class Tile {
    public Tile() {}

    public Tile(String filename, int x, int z, String gridFsId) {
        this.filename = filename;
        this.x = x;
        this.z = z;
        this.gridFsId = gridFsId;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
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

    public String getGridFsId() {
        return gridFsId;
    }

    public void setGridFsId(String gridFsId) {
        this.gridFsId = gridFsId;
    }

    @Id
    private String id;
    private String filename;
    private int x;
    private int z;
    private String gridFsId; // reference to GridFS file

    // constructors, getters, setters
}